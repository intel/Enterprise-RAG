# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import asyncio
import os
import string
from typing import Dict, Iterable, List, Optional, Tuple, Union
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from redis import exceptions
from redisvl.exceptions import RedisSearchError
from redisvl.index import AsyncSearchIndex
from redisvl.query import FilterQuery, TextQuery, VectorQuery, VectorRangeQuery
from redisvl.query.filter import FilterExpression, Num, Text
from redisvl.redis.connection import RedisConnectionFactory
from redisvl.redis.utils import array_to_buffer
from redisvl.schema import IndexSchema

from comps.cores.mega.logger import change_erag_logger_level, get_erag_logger
from comps.cores.proto.docarray import SearchedDoc, TextDoc
from comps.cores.utils.utils import get_boolean_env_var, sanitize_env
from comps.vectorstores.utils.connectors.connector import VectorStoreConnector


logger = get_erag_logger(f"{__file__.split('comps/')[1].split('/', 1)[0]}")
change_erag_logger_level(logger, log_level=os.getenv("ERAG_LOGGER_LEVEL", "INFO"))

class ConnectorRedis(VectorStoreConnector):
    CONTENT_FIELD_NAME = "text"
    EMBEDDING_FIELD_NAME = "embedding"

    # Scorer for the lexical (BM25) leg of hybrid search. BM25STD is RediSearch's
    # standard-tokenised BM25; see
    # https://redis.io/docs/latest/develop/interact/search-and-query/advanced-concepts/scoring/
    BM25_SCORER = "BM25STD"

    # Stopwords removed from the query before it is handed to RediSearch as a BM25
    # query. redisvl's default is to pull these from nltk, which is deliberately not a
    # dependency of the retriever image, so the list is inlined here (nltk's English
    # stopword list). Stopwords are removed from the QUERY only -- the index itself keeps
    # RediSearch's default server-side stopword handling.
    _TEXT_QUERY_STOPWORDS = frozenset({
        "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "you're",
        "you've", "you'll", "you'd", "your", "yours", "yourself", "yourselves", "he",
        "him", "his", "himself", "she", "she's", "her", "hers", "herself", "it", "it's",
        "its", "itself", "they", "them", "their", "theirs", "themselves", "what",
        "which", "who", "whom", "this", "that", "that'll", "these", "those", "am", "is",
        "are", "was", "were", "be", "been", "being", "have", "has", "had", "having",
        "do", "does", "did", "doing", "a", "an", "the", "and", "but", "if", "or",
        "because", "as", "until", "while", "of", "at", "by", "for", "with", "about",
        "against", "between", "into", "through", "during", "before", "after", "above",
        "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", "under",
        "again", "further", "then", "once", "here", "there", "when", "where", "why",
        "how", "all", "any", "both", "each", "few", "more", "most", "other", "some",
        "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
        "s", "t", "can", "will", "just", "don", "don't", "should", "should've", "now",
        "d", "ll", "m", "o", "re", "ve", "y", "ain", "aren", "aren't", "couldn",
        "couldn't", "didn", "didn't", "doesn", "doesn't", "hadn", "hadn't", "hasn",
        "hasn't", "haven", "haven't", "isn", "isn't", "ma", "mightn", "mightn't",
        "mustn", "mustn't", "needn", "needn't", "shan", "shan't", "shouldn",
        "shouldn't", "wasn", "wasn't", "weren", "weren't", "won", "won't", "wouldn",
        "wouldn't",
    })

    _TOKEN_TRIM_CHARS = string.punctuation + "“”‘’"

    def __init__(self, batch_size: int = 32):
        self.batch_size = batch_size
        self.index_dict = {}

    def _dims(self):
        return self._vector_schema_from_env()['dims']

    def _dtype(self):
        return self._vector_schema_from_env()['datatype']

    def _vector_schema_from_env(self):
        vector_schema = {
            "algorithm": str(sanitize_env(os.getenv("VECTOR_ALGORITHM", "FLAT"))), # "FLAT", "HNSW"
            "dims": int(sanitize_env(str(os.getenv("VECTOR_DIMS", 768)))),
            "datatype": str(sanitize_env(os.getenv("VECTOR_DATATYPE", "FLOAT32"))), # BFLOAT16, FLOAT16, FLOAT32, FLOAT64
            "distance_metric": str(sanitize_env(os.getenv("VECTOR_DISTANCE_METRIC", "COSINE"))) # L2, IP, COSINE
        }
        if vector_schema["algorithm"] == "HNSW":
            vector_schema.update(
                {
                    "m": int(sanitize_env(str(os.getenv("VECTOR_HNSW_M", 16)))),
                    "ef_construction": int(sanitize_env(str(os.getenv("VECTOR_HNSW_EF_CONSTRUCTION", 200)))),
                    "ef_runtime": int(sanitize_env(str(os.getenv("VECTOR_HNSW_EF_RUNTIME", 10)))),
                    "epsilon": float(sanitize_env(str(os.getenv("VECTOR_HNSW_EPSILON", 0.01))))
                }
            )
        elif vector_schema["algorithm"] == "SVS-VAMANA":
            vector_schema.update(
                {
                    "graph_max_degree": int(sanitize_env(str(os.getenv("VECTOR_SVS_GRAPH_MAX_DEGREE", 40)))),
                    "construction_window_size": int(sanitize_env(str(os.getenv("VECTOR_SVS_CONSTRUCTION_WINDOW_SIZE", 250)))),
                    "search_window_size": int(sanitize_env(str(os.getenv("VECTOR_SVS_SEARCH_WINDOW_SIZE", 200)))),
                    "compression": str(sanitize_env(os.getenv("VECTOR_SVS_COMPRESSION", "LeanVec4x8"))),
                }
            )
        return vector_schema

    def _metadata_schema(self):
        base_fields = [
            "id", "bucket_name", "site_name", "object_name", "file_id", "link_id", "url", "timestamp",
            "Header1", "Header2", "Header3", "Header4", "Header5", "Header6"
        ]

        metadata_schema = [{"name": field, "type": "text"} for field in base_fields]
        metadata_schema.append({"name": "start_index", "type": "numeric"})

        # Document metadata fields for filtering (text for exact match and wildcard search, numeric for range queries)
        metadata_schema.extend([{"name": f, "type": "text"} for f in ["file_title", "author"]])
        metadata_schema.extend([{"name": f, "type": "numeric"} for f in ["creation_date", "ingestion_date", "last_update_date"]])

        # Mark optional fields for index_missing support
        for field in metadata_schema:
            if field["name"] in ("file_id", "link_id", "site_name"):
                field["attrs"] = {"index_missing": True}

        return metadata_schema

    def _vector_schema(self, schema: dict, metadata_schema: Optional[dict]=None) -> IndexSchema:
        model_name = sanitize_env(os.getenv("EMBEDDING_MODEL_NAME", "default")).replace("/", "_").replace("-", "_")
        index_name = f"{model_name.lower()}_{schema['algorithm'].lower()}_{schema['datatype'].lower()}_{schema['distance_metric'].lower()}_{schema['dims']}_index"

        data = {
            "index": {
                "name": index_name,
                "prefix": "erag",
                "storage_type": "hash"
            },
            "fields": [
                {
                    "name": ConnectorRedis.CONTENT_FIELD_NAME,
                    "type": "text"
                },
                {
                    "name": ConnectorRedis.EMBEDDING_FIELD_NAME,
                    "type": "vector",
                    "attrs": {
                        "datatype": schema['datatype'],
                        "algorithm": schema['algorithm'],
                        "dims": schema['dims'],
                        "distance_metric": schema['distance_metric'],
                    },
                }
            ]
        }

        if metadata_schema:
            data["fields"].extend(metadata_schema)

        if schema['algorithm'].lower() == "hnsw":
            data['fields'][1]['attrs'].update(
                {
                    "m": schema['m'],
                    "ef_construction": schema['ef_construction'],
                    "ef_runtime": schema['ef_runtime'],
                    "epsilon": schema['epsilon']
                }
            )
        elif schema['algorithm'].lower() == "svs-vamana":
            data['fields'][1]['attrs'].update(
                {
                    "graph_max_degree": schema['graph_max_degree'],
                    "construction_window_size": schema['construction_window_size'],
                    "search_window_size": schema['search_window_size'],
                    "compression": schema['compression'],
                }
            )

        return IndexSchema.from_dict(data)

    async def _create_index(self, schema: IndexSchema, overwrite: bool=False) -> AsyncSearchIndex:
        logger.info(f"Creating index: {schema.index.name}")
        index = AsyncSearchIndex(schema=schema, redis_url=ConnectorRedis.format_url_from_env())
        try:
            await index.create(overwrite=overwrite)
        except RedisSearchError as e:
            if "Index already exists" in str(e):
                logger.info(f"Index {schema.index.name} already exists, reusing it.")
            else:
                raise
        return index

    async def vector_index(self) -> AsyncSearchIndex:
        schema = self._vector_schema(self._vector_schema_from_env(), self._metadata_schema())
        index_name = schema.index.name

        if self.index_dict.get(index_name, None) is not None:
            index = self.index_dict[index_name]
            try:
                await index._redis_client.ping()
                if await index.exists():
                    return index
            except (exceptions.ConnectionError, exceptions.TimeoutError, exceptions.RedisClusterException):
                logger.warning("Redis connection was lost. Reconnecting...")

        index = await self._create_index(schema)
        self.index_dict[index_name] = index
        return index

    def _process_data(self, texts: List[str], embeddings: List[List[float]], metadatas: List[dict]=None):
        datas = [
            {
                "text": text,
                "embedding": array_to_buffer(embedding, dtype=self._dtype()),
                **(metadata if metadata is not None else {})
            }
            for text, embedding, metadata in zip(
                texts, embeddings, metadatas or [None] * len(texts)
            )
        ]
        return datas

    async def add_texts(self, texts: List[str], embeddings: List[List[float]], metadatas: List[dict]=None):
        try:
            data = self._process_data(texts, embeddings, metadatas)
            index = await self.vector_index()
            result = await index.load(data)
            return list(result) if result is not None else []
        except Exception as e:
            logger.exception("Error occured while adding texts")
            raise e

    def _search_schema(self, field_name: str) -> IndexSchema:
        data = {
            "index": {
                "name": f"search_{field_name}",
                "prefix": "erag",
                "storage_type": "hash"
            },
            "fields": [
                {
                    "name": field_name,
                    "type": "text"
                }
            ]
        }
        return IndexSchema.from_dict(data)

    async def search_index(self, field_name: str) -> AsyncSearchIndex:
        schema = self._search_schema(field_name)
        index_name = schema.index.name

        if self.index_dict.get(index_name, None) is not None:
            index = self.index_dict[index_name]
            exists = await index.exists()
            if exists:
                logger.info(f"Using index {index_name} exists.")
                return index
            else:
                logger.info(f"Index {index_name} memoized but not available in redis.")

        index = await self._create_index(schema)
        self.index_dict[index_name]=index
        return index

    async def search_by_metadata(self, field_name: str, field_value: str):
        filter = Text(field_name) == field_value
        query = FilterQuery(num_results=10000, filter_expression=filter)
        index = await self.search_index(field_name)
        return await index.search(query)

    async def search_and_delete_by_metadata(self, field_name: str, field_value: str):
        client = RedisConnectionFactory.connect(
            redis_url=ConnectorRedis.format_url_from_env(),
            use_async=True
        )
        try:
            logger.debug(f"Searching and deleting documents with {field_name}={field_value}")
            while True:
                results = await self.search_by_metadata(field_name, field_value)
                if not results.docs or len(results.docs) == 0:
                    logger.debug("No more documents found to delete.")
                    break
                logger.debug(f"Deleting {len(results.docs)} documents")
                for r in results.docs:
                    await client.delete(r.id)
        finally:
            if client is not None:
                await client.close()

    def _build_vector_query(
        self,
        vector: List[float],
        k: int,
        distance_threshold: float=None,
        dtype: str="float32",
        filter_expression: Optional[Union[str, FilterExpression]] = None,
        return_fields: Optional[List[str]]=None
    ):
        filter_str = str(filter_expression) if filter_expression is not None else "None"
        logger.info(
            f"Building vector query: k={k}, distance_threshold={distance_threshold}, "
            f"dtype={dtype}, filter_expression={filter_str}"
        )

        if distance_threshold is not None:
            return VectorRangeQuery(
                vector=vector,
                vector_field_name="embedding",
                num_results=k,
                filter_expression=filter_expression,
                distance_threshold=distance_threshold,
                dtype=dtype,
                return_fields=return_fields
            )
        else:
            return VectorQuery(
                vector=vector,
                vector_field_name="embedding",
                num_results=k,
                filter_expression=filter_expression,
                dtype=dtype,
                return_fields=return_fields
            )

    def _parse_search_results(self, input_text: str, results: Iterable[any]) -> SearchedDoc:
        searched_docs = []
        for r in results:
            searched_docs.append(self._convert_to_text_doc(r))

        return SearchedDoc(retrieved_docs=searched_docs, user_prompt=input_text)

    async def similarity_search_by_vector(self, input_text: str, embedding: List[float], k: int, distance_threshold: float = None, filter_expression: Optional[Union[str, FilterExpression]] = None, parse_result: bool = True) -> SearchedDoc:
        try:
            fields = self._return_fields(include_vector_distance=True)

            v = self._build_vector_query(
                vector=embedding,
                k=k,
                dtype=self._dtype(),
                return_fields=fields,
                distance_threshold=distance_threshold,
                filter_expression=filter_expression
            )
            index = await self.vector_index()
            result = await index.search(v.query, query_params=v.params)

            if parse_result:
                return self._parse_search_results(input_text=input_text, results=result.docs)
            else:
                return result
        except exceptions.ResponseError as e:
            if "no such index" in str(e):
                logger.warning("No such index found in vector store. Import data first.")
                return SearchedDoc(retrieved_docs=[], user_prompt=input_text)
            raise e
        except Exception as e:
            logger.exception("Error occured while searching by vector")
            raise e

    def _return_fields(self, include_vector_distance: bool = True) -> List[str]:
        """Fields to fetch back from RediSearch: the chunk text plus all metadata."""
        fields = [ConnectorRedis.CONTENT_FIELD_NAME]
        if include_vector_distance:
            fields.append(VectorQuery.DISTANCE_ID)
        if self._metadata_schema():
            fields.extend([field['name'] for field in self._metadata_schema()])
        return fields

    @classmethod
    def _has_lexical_tokens(cls, text: str) -> bool:
        """True if *text* still holds at least one searchable term after stopword removal.

        A query made up entirely of stopwords/punctuation ("what is the?") would produce
        an empty RediSearch text query, so the lexical leg has to be skipped for it.
        """
        for token in text.split():
            token = token.strip(cls._TOKEN_TRIM_CHARS).lower()
            if token and token not in cls._TEXT_QUERY_STOPWORDS:
                return True
        return False

    def _build_text_query(
        self,
        input_text: str,
        k: int,
        filter_expression: Optional[Union[str, FilterExpression]] = None,
        return_fields: Optional[List[str]] = None
    ) -> Optional[TextQuery]:
        """Build a BM25 full-text query over the chunk text field.

        The same *filter_expression* used by the vector leg is applied here, so RBAC,
        links/files and metadata filtering behave identically in both legs. redisvl
        escapes the query tokens (TokenEscaper), so no manual escaping is needed.

        Returns None when the query has no searchable terms left after stopword removal.
        """
        if not input_text or not self._has_lexical_tokens(input_text):
            logger.warning(
                "Query has no searchable terms after stopword removal; skipping the BM25 leg."
            )
            return None

        filter_str = str(filter_expression) if filter_expression is not None else "None"
        logger.info(
            f"Building BM25 text query: k={k}, scorer={ConnectorRedis.BM25_SCORER}, "
            f"filter_expression={filter_str}"
        )
        return TextQuery(
            text=input_text,
            text_field_name=ConnectorRedis.CONTENT_FIELD_NAME,
            text_scorer=ConnectorRedis.BM25_SCORER,
            filter_expression=filter_expression,
            return_fields=return_fields,
            num_results=k,
            # redisvl type-checks this against typing.Set/List/Tuple, which a frozenset
            # does not satisfy, so hand it a mutable copy of the constant.
            stopwords=set(ConnectorRedis._TEXT_QUERY_STOPWORDS),
        )

    async def bm25_search(
        self,
        input_text: str,
        k: int,
        filter_expression: Optional[Union[str, FilterExpression]] = None,
        parse_result: bool = True
    ) -> SearchedDoc:
        """Lexical BM25 search over the indexed chunk text.

        With contextual RAG enabled the indexed text is `blurb + "\\n\\n" + chunk`, so this
        is Anthropic's "contextual BM25": the LLM-generated context is searchable
        lexically as well as semantically.

        Args:
            input_text: the user query.
            k: number of results to return.
            filter_expression: the same filter expression the vector leg uses.
            parse_result: return a SearchedDoc (True) or the raw RediSearch result (False).
        """
        try:
            t = self._build_text_query(
                input_text=input_text,
                k=k,
                filter_expression=filter_expression,
                return_fields=self._return_fields(include_vector_distance=False)
            )
            if t is None:
                return SearchedDoc(retrieved_docs=[], user_prompt=input_text) if parse_result else None

            index = await self.vector_index()
            result = await index.search(t.query, query_params=t.params)
            logger.info(f"BM25 leg matched {result.total} chunk(s), returning {len(result.docs)}")

            if parse_result:
                return self._parse_search_results(input_text=input_text, results=result.docs)
            return result
        except exceptions.ResponseError as e:
            if "no such index" in str(e):
                logger.warning("No such index found in vector store. Import data first.")
                return SearchedDoc(retrieved_docs=[], user_prompt=input_text) if parse_result else None
            raise e
        except Exception as e:
            logger.exception("Error occured while searching with BM25")
            raise e

    @staticmethod
    def _reciprocal_rank_fusion(
        ranked_lists: List[Tuple[List[str], float]],
        rrf_k: int = 0
    ) -> Dict[str, float]:
        """Weighted Reciprocal Rank Fusion.

        Each input is a (list of document ids ordered best-first, weight) pair. A document
        at 0-based rank *r* in a list contributes ``weight / (rrf_k + r + 1)`` to its score.
        Only ranks matter, so the incomparable score scales of cosine distance and BM25
        never have to be normalised against each other.

        Args:
            ranked_lists: the per-retriever ranked id lists with their weights.
            rrf_k: rank-smoothing constant; larger values flatten the weight given to top
                ranks. 0 reproduces Anthropic's reference implementation (``weight / rank``).
                The canonical Cormack RRF constant of 60 flattens ranks so aggressively that
                with an 0.8/0.2 weighting the lexical leg cannot promote any chunk the dense
                leg missed (0.2/61 < 0.8/70), so use 60 only with balanced weights.

        Returns:
            dict mapping document id -> fused score (higher is better).
        """
        scores: Dict[str, float] = {}
        for ids, weight in ranked_lists:
            if not weight:
                continue
            for rank, doc_id in enumerate(ids):
                scores[doc_id] = scores.get(doc_id, 0.0) + weight / (rrf_k + rank + 1)
        return scores

    async def hybrid_search_by_vector(
        self,
        input_text: str,
        embedding: List[float],
        k: int,
        candidate_k: int = 100,
        rrf_k: int = 0,
        semantic_weight: float = 0.8,
        bm25_weight: float = 0.2,
        distance_threshold: float = None,
        filter_expression: Optional[Union[str, FilterExpression]] = None
    ) -> SearchedDoc:
        """Hybrid retrieval: dense vector search + BM25, fused with weighted RRF.

        This is the retrieval half of Anthropic's Contextual Retrieval recipe
        (https://www.anthropic.com/engineering/contextual-retrieval): both legs run over
        the contextualised chunk text, each returns *candidate_k* candidates, the two
        rankings are fused by reciprocal rank, and the top *k* fused chunks are handed to
        the reranker.

        The legs are issued concurrently. The vector leg is authoritative: if the BM25 leg
        fails the search degrades to vector-only rather than failing the request.

        Args:
            input_text: the user query (used for the BM25 leg and echoed in the result).
            embedding: query embedding for the dense leg.
            k: number of fused chunks to return.
            candidate_k: candidates fetched from EACH leg before fusion (Anthropic use 150;
                the default here is 100, raised to *k* when smaller).
            rrf_k: RRF rank-smoothing constant; 0 = Anthropic's ``weight / rank``.
            semantic_weight: weight of the dense leg in the fusion.
            bm25_weight: weight of the lexical leg in the fusion.
            distance_threshold: optional distance cut-off for the dense leg.
            filter_expression: filter applied identically to both legs.

        Returns:
            SearchedDoc with up to *k* documents ordered by fused score. Each document's
            metadata carries `rrf_score`, `retrieval_source` ("hybrid"/"vector"/"bm25"),
            and the per-leg ranks/scores it was fused from.
        """
        if semantic_weight <= 0 and bm25_weight <= 0:
            raise ValueError("At least one of semantic_weight / bm25_weight must be greater than 0")

        # Both legs need a deeper candidate pool than the number of fused results.
        candidate_k = max(candidate_k, k)

        async def vector_leg():
            if semantic_weight <= 0:
                return []
            res = await self.similarity_search_by_vector(
                input_text=input_text,
                embedding=embedding,
                k=candidate_k,
                distance_threshold=distance_threshold,
                filter_expression=filter_expression,
                parse_result=False
            )
            # similarity_search_by_vector returns an empty SearchedDoc when the index is missing
            return list(res.docs) if hasattr(res, "docs") else []

        async def bm25_leg():
            if bm25_weight <= 0:
                return []
            res = await self.bm25_search(
                input_text=input_text,
                k=candidate_k,
                filter_expression=filter_expression,
                parse_result=False
            )
            return list(res.docs) if res is not None and hasattr(res, "docs") else []

        vector_docs, bm25_docs = await asyncio.gather(
            vector_leg(), bm25_leg(), return_exceptions=True
        )

        if isinstance(vector_docs, BaseException):
            # The dense leg is the primary retriever - a failure there is a real failure.
            logger.error(f"Vector leg of hybrid search failed: {vector_docs}")
            raise vector_docs
        if isinstance(bm25_docs, BaseException):
            logger.warning(
                f"BM25 leg of hybrid search failed, falling back to vector-only retrieval: {bm25_docs}"
            )
            bm25_docs = []

        vector_ranks = {doc.id: rank for rank, doc in enumerate(vector_docs)}
        bm25_ranks = {doc.id: rank for rank, doc in enumerate(bm25_docs)}

        scores = self._reciprocal_rank_fusion(
            [
                ([doc.id for doc in vector_docs], semantic_weight),
                ([doc.id for doc in bm25_docs], bm25_weight),
            ],
            rrf_k=rrf_k
        )
        if not scores:
            return SearchedDoc(retrieved_docs=[], user_prompt=input_text)

        # Prefer the vector-leg copy of a document: it carries vector_distance.
        raw_docs = {doc.id: doc for doc in bm25_docs}
        raw_docs.update({doc.id: doc for doc in vector_docs})

        # Sort by fused score, then by each leg's rank, so the order is deterministic
        # for documents that tie.
        ordered_ids = sorted(
            scores,
            key=lambda doc_id: (
                -scores[doc_id],
                vector_ranks.get(doc_id, len(vector_docs)),
                bm25_ranks.get(doc_id, len(bm25_docs)),
            )
        )[:k]

        overlap = len(vector_ranks.keys() & bm25_ranks.keys())
        logger.info(
            f"Hybrid search fused {len(vector_docs)} vector + {len(bm25_docs)} BM25 candidates "
            f"({overlap} in both) into {len(ordered_ids)} result(s); "
            f"rrf_k={rrf_k}, semantic_weight={semantic_weight}, bm25_weight={bm25_weight}"
        )

        searched_docs = []
        for doc_id in ordered_ids:
            text_doc = self._convert_to_text_doc(raw_docs[doc_id])
            in_vector = doc_id in vector_ranks
            in_bm25 = doc_id in bm25_ranks
            text_doc.metadata["rrf_score"] = scores[doc_id]
            text_doc.metadata["retrieval_source"] = (
                "hybrid" if in_vector and in_bm25 else ("vector" if in_vector else "bm25")
            )
            if in_vector:
                text_doc.metadata["vector_rank"] = vector_ranks[doc_id] + 1
            if in_bm25:
                text_doc.metadata["bm25_rank"] = bm25_ranks[doc_id] + 1
                bm25_score = getattr(raw_docs[doc_id], "score", None)
                if bm25_score is None and doc_id in bm25_ranks:
                    bm25_score = getattr(bm25_docs[bm25_ranks[doc_id]], "score", None)
                if bm25_score is not None:
                    text_doc.metadata["bm25_score"] = float(bm25_score)
            searched_docs.append(text_doc)

        return SearchedDoc(retrieved_docs=searched_docs, user_prompt=input_text)

    def get_files_filter_expression(self) -> FilterExpression:
        """
        Use is_missing operator for link_id to filter out links and return only files.
        Returns:
            FilterExpression: Returns a filter expression matching only files.
        """
        logger.debug("Adding files filter expression")
        return Text("link_id").is_missing()

    def get_links_filter_expression(self) -> FilterExpression:
        """
        Use is_missing operator for file_id to filter out files and return only links.
        Returns:
            FilterExpression: Returns a filter expression to query only links.
        """
        logger.debug("Adding links filter expression")
        return Text("file_id").is_missing()

    def get_bucket_name_filter_expression(self, bucket_names: List[str]) -> FilterExpression:
        """
        Constructs a filter expression for bucket names.
        Args:
            bucket_names (List[str]): List of bucket names to filter by.
        Returns:
            FilterExpression: The filter expression for the bucket names.
        """
        logger.debug(f"Bucket names in filter expression: {bucket_names}")
        if len(bucket_names) == 0:
            raise ValueError("Bucket names list cannot be empty")
        bucket_name_filter = Text("bucket_name") == bucket_names[0]
        for bucket_name in bucket_names[1:]:
            bucket_name_filter |= Text("bucket_name") == bucket_name

        logger.debug(f"Filter expression for bucket names: {str(bucket_name_filter)}")
        return bucket_name_filter

    def get_site_name_filter_expression(self, site_names: List[str]) -> FilterExpression:
        """
        Constructs a filter expression for SharePoint site names.
        Args:
            site_names (List[str]): List of site names to filter by.
        Returns:
            FilterExpression: The filter expression for the site names.
        """
        logger.debug(f"Site names in filter expression: {site_names}")
        if len(site_names) == 0:
            raise ValueError("Site names list cannot be empty")
        site_name_filter = Text("site_name") == site_names[0]
        for sn in site_names[1:]:
            site_name_filter |= Text("site_name") == sn

        logger.debug(f"Filter expression for site names: {str(site_name_filter)}")
        return site_name_filter

    def get_object_name_filter_expression(self, bucket_name: str, object_name: str) -> FilterExpression:
        """
        Constructs a filter expression for bucket name and object name.
        Args:
            bucket_name (str): The name of the bucket.
            object_name (str): The name of the object.
        Returns:
            FilterExpression: The filter expression for the bucket names.
        Raises:
            ValueError: If bucket_name and/or object_name is empty.
        """
        if len(bucket_name) == 0 or len(object_name) == 0:
            raise ValueError("Bucket name and object name cannot be empty")
        bucket_name_filter = Text("bucket_name") == bucket_name
        object_name_filter = Text("object_name") == object_name

        bucket_object_filter = bucket_name_filter & object_name_filter
        logger.debug(f"Filter expression for bucket name and object name: {str(bucket_object_filter)}")
        return bucket_object_filter

    def _convert_to_text_doc(self, doc):
        """Helper method to convert a raw Redis result to a TextDoc"""
        metadata = {}
        for field in [VectorQuery.DISTANCE_ID] + [field['name'] for field in self._metadata_schema()]:
            try:
                metadata[field] = doc[field]
            except (AttributeError, KeyError):
                continue

        return TextDoc(
            text=doc[ConnectorRedis.CONTENT_FIELD_NAME],
            metadata=metadata
        )

    async def similarity_search_with_siblings(self, input_text: str, embedding: List[float],
                                              k: int,
                                              distance_threshold: float = None,
                                              filter_expression: Optional[Union[str, FilterExpression]] = None) -> SearchedDoc:
        """
        Performs a similarity search and retrieves sibling chunks based on document structure.

        For chunks with headers: Retrieves 1 chunk before and 1 after with matching headers
        For chunks without headers: Retrieves 1 chunk before and 1 after based on start_index

        Args:
            input_text: The user query text
            embedding: The vector embedding for similarity search
            k: Number of similar chunks to retrieve initially
            distance_threshold: Optional threshold for similarity
            filter_expression: Optional filters for the initial search

        Returns:
            SearchedDoc containing both the similar chunks and their siblings
        """
        # First get the k most similar chunks
        initial_result = await self.similarity_search_by_vector(
            input_text=input_text,
            embedding=embedding,
            k=k,
            distance_threshold=distance_threshold,
            filter_expression=filter_expression,
            parse_result=False  # Get raw results to work with
        )

        # Get vector index to use for sibling queries
        index = await self.vector_index()

        # If no results or error, return empty result
        if not hasattr(initial_result, 'docs') or not initial_result.docs:
            return SearchedDoc(retrieved_docs=[], user_prompt=input_text)

        # Process the main retrieved documents
        primary_docs = []

        for doc in initial_result.docs:
            metadata = {}
            for field in [VectorQuery.DISTANCE_ID] + [field['name'] for field in self._metadata_schema()]:
                try:
                    metadata[field] = doc[field]
                except (AttributeError, KeyError):
                    continue

            primary_docs.append(
                TextDoc(
                    text=doc[ConnectorRedis.CONTENT_FIELD_NAME],
                    metadata=metadata
                )
            )

        logger.debug(f"Found {len(primary_docs)} primary documents for input: {input_text}")
        all_sibling_docs = {}

        # We only find siblings for files therefore use file_id for file uniqueness.
        # Using object_name would not work since it might not be unique across different buckets.
        for doc in initial_result.docs:
            sibling_docs = []
            if not hasattr(doc, 'file_id') or not hasattr(doc, 'start_index'):
                continue

            object_id = doc.file_id
            start_index = doc.start_index

            has_headers = False
            header_filter = None
            if filter_expression is None:
                header_filter = Text('file_id') == object_id
            else:
                header_filter = filter_expression & (Text('file_id') == object_id)

            for i in range(1, 7):
                header_key = f'Header{i}'
                header_value = getattr(doc, header_key, None)
                if header_value:
                    has_headers = True
                    header_value = header_value.replace(":", "")
                    header_filter = header_filter & (Text(header_key) % str(header_value))

            if has_headers:
                # Case 1: Document has headers - get siblings with matching headers
                header_query = FilterQuery(filter_expression=header_filter, num_results=100)
                header_result = await index.search(header_query)
                logger.debug(f"Retrieved header chunks: {len(header_result.docs)} for header_filter: {header_filter}")

                if header_result.docs:
                    sorted_chunks = sorted(header_result.docs, key=lambda x: int(x.start_index) if hasattr(x, 'start_index') else 0)
                    current_pos = -1
                    for i, chunk in enumerate(sorted_chunks):
                        if chunk.id == doc.id:
                            current_pos = i
                            break

                    if current_pos != -1:
                        if current_pos > 0:
                            prev_chunk = sorted_chunks[current_pos - 1]
                            sibling_docs.append(self._convert_to_text_doc(prev_chunk))

                        if current_pos < len(sorted_chunks) - 1:
                            next_chunk = sorted_chunks[current_pos + 1]
                            sibling_docs.append(self._convert_to_text_doc(next_chunk))
            else:
                # Case 2: Document doesn't have headers - get nearest chunks by start_index
                before_filter = None
                if filter_expression is None:
                    before_filter = (Text('file_id') == object_id) & (Num('start_index') < int(start_index))
                else:
                    before_filter = filter_expression & (Text('file_id') == object_id) & (Num('start_index') < int(start_index))
                before_query = FilterQuery(filter_expression=before_filter, num_results=100)
                before_result = await index.search(before_query)

                if before_result.docs:
                    prev_chunk = max(before_result.docs, key=lambda x: int(x.start_index) if hasattr(x, 'start_index') else 0)
                    logger.debug(f"Retrieved previous chunk: {prev_chunk.id, prev_chunk.start_index}")
                    prev_doc = self._convert_to_text_doc(prev_chunk)
                    prev_doc.metadata["vector_distance"] = -1 # Siblings do not have a distance score
                    sibling_docs.append(prev_doc)

                after_filter = None
                if filter_expression is None:
                    after_filter = (Text('file_id') == object_id) & (Num('start_index') > int(start_index))
                else:
                    after_filter = filter_expression & (Text('file_id') == object_id) & (Num('start_index') > int(start_index))
                after_query = FilterQuery(filter_expression=after_filter, num_results=100)
                after_result = await index.search(after_query)

                if after_result.docs:
                    next_chunk = min(after_result.docs, key=lambda x: int(x.start_index) if hasattr(x, 'start_index') else 0)
                    logger.debug(f"Retrieved next chunk: {next_chunk.id, next_chunk.start_index}")
                    next_doc = self._convert_to_text_doc(next_chunk)
                    next_doc.metadata["vector_distance"] = -1 # Siblings do not have a distance score
                    sibling_docs.append(next_doc)

            all_sibling_docs[doc.id] = sibling_docs

        logger.debug(f"Final sibling docs: {all_sibling_docs}")
        return SearchedDoc(retrieved_docs=primary_docs, sibling_docs=all_sibling_docs, user_prompt=input_text)

    def get_author_filter_expression(self, authors: Union[str, List[str]]) -> FilterExpression:
        """
        Constructs a filter expression for one or more authors.
        Args:
            authors (Union[str, List[str]]): Single author name or list of author names to filter by.
        Returns:
            FilterExpression: The filter expression for author(s) - uses OR logic for multiple authors.
        Raises:
            ValueError: If authors is empty, contains only whitespace, or is an empty list.
        """
        # Normalize to list
        author_list = [authors] if isinstance(authors, str) else authors

        if not author_list or (len(author_list) == 1 and not author_list[0].strip()):
            raise ValueError("Author(s) cannot be empty")

        # Filter out empty strings and strip whitespace
        author_list = [a.strip() for a in author_list if a and a.strip()]

        if not author_list:
            raise ValueError("Author(s) cannot be empty after filtering")

        logger.debug(f"Adding author filter expression for {len(author_list)} author(s): {author_list}")

        result = Text("author") % author_list[0]
        for author in author_list[1:]:
            result |= Text("author") % author
        return result

    def get_text_exclude_filter_expression(self, field: str, value: str) -> FilterExpression:
        """
        Constructs a negated filter expression for any text field (NOT match).
        Args:
            field (str): The text field name (e.g. 'author', 'file_title').
            value (str): The value to exclude.
        Returns:
            FilterExpression: The negated filter expression (e.g. -@author:"name").
        Raises:
            ValueError: If field or value is empty or whitespace.
        """
        if not field or not field.strip():
            raise ValueError("Field name cannot be empty")
        if not value or not value.strip():
            raise ValueError("Exclusion value cannot be empty")
        value = value.strip()
        logger.debug(f"Adding exclusion filter expression for {field}: {value}")
        return Text(field) != value

    def get_author_exclude_filter_expression(self, author: str) -> FilterExpression:
        """
        Constructs a negated word-intersection filter for author.
        Uses the same matching logic as inclusion (%) so that e.g.
        excluding "Jane Doe" also excludes "Doe, Jane".
        """
        if not author or not author.strip():
            raise ValueError("Author exclusion value cannot be empty")
        author = author.strip()
        logger.debug(f"Adding author exclusion filter expression: {author}")
        return FilterExpression(f"(-@author:({author}))")

    # File extensions that indicate the query value is a filename (not a document title)
    _FILENAME_EXTENSIONS = frozenset({
        "pdf", "docx", "xlsx", "pptx", "doc", "xls", "ppt",
        "txt", "md", "json", "yaml", "yml", "csv", "html", "xml", "log",
    })

    @staticmethod
    def _looks_like_filename(value: str) -> bool:
        """Return True if *value* has a recognised file extension."""
        dot = value.rfind(".")
        return dot > 0 and value[dot + 1:].lower() in ConnectorRedis._FILENAME_EXTENSIONS

    def get_title_filter_expression(self, title_pattern: str, exact_match: bool = False) -> FilterExpression:
        """
        Constructs a filter expression for file_title field.

        When the pattern looks like a filename (e.g. ``report.pptx``), the
        expression also searches the ``object_name`` field with OR logic so
        that files stored by their original name can be found.

        Args:
            title_pattern (str): The title or pattern to filter by.
            exact_match (bool): If True, use exact match; if False, use wildcard contains.
        Returns:
            FilterExpression: The filter expression for file_title (and optionally object_name).
        Raises:
            ValueError: If title_pattern is empty.
        """
        if not title_pattern or not title_pattern.strip():
            raise ValueError("Title pattern cannot be empty")
        title_pattern = title_pattern.strip()
        logger.debug(f"Adding title filter expression: {title_pattern}, exact_match={exact_match}")

        if exact_match:
            title_filter = Text("file_title") == title_pattern
        else:
            title_filter = Text("file_title") % f"*{title_pattern}*"

        # When the value is a filename, also search object_name (stores the
        # original uploaded file name / object key in the bucket).
        if ConnectorRedis._looks_like_filename(title_pattern):
            object_filter = Text("object_name") % f"*{title_pattern}*"
            logger.debug(f"Filename detected — also searching object_name for: {title_pattern}")
            return title_filter | object_filter

        return title_filter

    def get_date_range_filter_expression(self, field: str, start: int = None, end: int = None) -> FilterExpression:
        """
        Constructs a filter expression for date range filtering.
        Args:
            field (str): The date field to filter by. Must be one of: creation_date, ingestion_date, or last_update_date.
            start (int): Optional start timestamp (inclusive). If None, only end is used.
            end (int): Optional end timestamp (inclusive). If None, only start is used.
        Returns:
            FilterExpression: The filter expression for the date range.
        Raises:
            ValueError: If field is invalid or both start and end are None.
        """
        if field not in ("creation_date", "ingestion_date", "last_update_date"):
            raise ValueError(f"Invalid date field: {field}")
        if start is None and end is None:
            raise ValueError("At least one of start or end timestamp required")
        if start is not None and end is not None:
            return (Num(field) >= start) & (Num(field) <= end)
        return Num(field) >= start if start is not None else Num(field) <= end

    @staticmethod
    def format_url_from_env():
        """
        Formats the Redis URL based on environment variables.
        Returns:
            str: The formatted Redis URL.
        """
        redis_url = sanitize_env(os.getenv("REDIS_URL", None))
        vector_store = sanitize_env(os.getenv("VECTOR_STORE", "")).lower()
        should_be_cluster = True if vector_store == "redis-cluster" else False

        if redis_url:
            parsed_url = urlparse(redis_url)
            query_params = parse_qs(parsed_url.query)
            # Get query parameter keys, make them lowercase, and ensure uniqueness
            query_keys = {key.lower() for key in query_params.keys()}

            # Check if "cluster" parameter exists and if required, append it
            if "cluster" not in query_keys and should_be_cluster:
                query_params["cluster"] = ["true"]

            new_url = urlunparse((
                parsed_url.scheme,
                parsed_url.netloc,
                "/" if parsed_url.path == "" else parsed_url.path,
                parsed_url.params,
                urlencode(query_params, doseq=True),
                parsed_url.fragment
            ))
            return new_url
        else:
            host = sanitize_env(os.getenv("REDIS_HOST", 'localhost'))
            port = int(sanitize_env(os.getenv("REDIS_PORT", 6379)))
            using_ssl = get_boolean_env_var("REDIS_SSL", False)
            schema = "rediss" if using_ssl else "redis"
            username = sanitize_env(os.getenv("REDIS_USERNAME", "default"))
            password = sanitize_env(os.getenv("REDIS_PASSWORD", None))

            query_params = {}
            if should_be_cluster:
                query_params["cluster"] = ["true"]

            netloc = f"{username}:{password}@{host}:{port}" if password else f"{host}:{port}"
            new_url = urlunparse((
                schema,
                netloc,
                "/", # path
                "", # params
                urlencode(query_params, doseq=True), # query
                "" # fragment
            ))
            return new_url
