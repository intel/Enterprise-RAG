# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import os
import time
from typing import Union

from dotenv import load_dotenv
from fastapi import HTTPException, Request

from comps.cores.mega.base_statistics import register_statistics, statistics_dict
from comps.cores.mega.constants import MegaServiceEndpoint, ServiceType
from comps.cores.mega.logger import change_erag_logger_level, get_erag_logger
from comps.cores.mega.micro_service import erag_microservices, register_microservice
from comps.cores.proto.docarray import EmbedDoc, EmbedDocList, SearchedDoc
from comps.cores.utils.utils import sanitize_env
from comps.retrievers.utils import erag_retriever


# Define the unique service name for the microservice
USVC_NAME='erag_service@retriever'

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(__file__), "impl/microservice/.env"))

# Initialize the logger for the microservice
logger = get_erag_logger(f"{__file__.split('comps/')[1].split('/', 1)[0]}_microservice")
change_erag_logger_level(logger, log_level=os.getenv("ERAG_LOGGER_LEVEL", "INFO"))

# Initialize an instance of the EragRetriever class with environment variables.

retriever = erag_retriever.EragRetriever(
    vector_store=sanitize_env(os.getenv("VECTOR_STORE")),
    rbac_enabled=str(os.getenv('VECTOR_DB_RBAC')).lower() in ['true', '1', 't', 'y', 'yes']
)

# Hybrid search (contextual BM25 + contextual embeddings fused with Reciprocal Rank
# Fusion). Deployed with HYBRID_SEARCH_ENABLED=True whenever contextual RAG is enabled,
# because the blurbs that make hybrid search worthwhile are produced at ingest time.
# When enabled, requests asking for the plain "similarity" search type are served as
# "hybrid"; use search_type "vector" to force dense-only retrieval, or "hybrid" to force
# hybrid retrieval on a deployment where the flag is off.
HYBRID_SEARCH_ENABLED = str(sanitize_env(os.getenv("HYBRID_SEARCH_ENABLED", "false"))).lower() in [
    'true', '1', 't', 'y', 'yes'
]
HYBRID_SEARCH_ENV_DEFAULTS = {
    "hybrid_candidate_k": ("HYBRID_SEARCH_CANDIDATE_K", int),
    "hybrid_result_k": ("HYBRID_SEARCH_RESULT_K", int),
    "rrf_k": ("HYBRID_SEARCH_RRF_K", int),
    "semantic_weight": ("HYBRID_SEARCH_SEMANTIC_WEIGHT", float),
    "bm25_weight": ("HYBRID_SEARCH_BM25_WEIGHT", float),
}

if HYBRID_SEARCH_ENABLED:
    logger.info(
        "Hybrid search enabled: 'similarity' requests are served as 'hybrid' "
        "(BM25 + dense vector search fused with RRF)."
    )


def _request_body_for_doc(req_data) -> dict:
    """The JSON object the retrieval parameters were sent in (EmbedDoc or EmbedDocList)."""
    if not isinstance(req_data, dict):
        return {}
    docs = req_data.get("docs")
    if isinstance(docs, list) and docs and isinstance(docs[0], dict):
        return docs[0]
    return req_data


def apply_hybrid_search_defaults(vector: EmbedDoc, req_data) -> None:
    """Turn the deployment's hybrid-search defaults into effective request parameters.

    Explicit per-request values always win: an env default is only applied to a field the
    caller did not send.
    """
    if not HYBRID_SEARCH_ENABLED:
        return

    if vector.search_type == "similarity":
        vector.search_type = "hybrid"

    if vector.search_type != "hybrid":
        return

    body = _request_body_for_doc(req_data)
    for field, (env_name, cast) in HYBRID_SEARCH_ENV_DEFAULTS.items():
        if field in body:
            continue  # caller set it explicitly
        raw = sanitize_env(os.getenv(env_name))
        if not raw:
            continue
        try:
            setattr(vector, field, cast(raw))
        except (TypeError, ValueError):
            logger.warning(f"Ignoring invalid {env_name}={raw!r}; keeping {field}={getattr(vector, field)}")

@register_microservice(
    name=USVC_NAME,
    service_type=ServiceType.RETRIEVER,
    endpoint=str(MegaServiceEndpoint.RETRIEVAL),
    host="0.0.0.0",
    port=int(os.getenv('RETRIEVER_USVC_PORT', default=6620)),
    input_datatype=Union[EmbedDoc, EmbedDocList],
    output_datatype=SearchedDoc,
)
@register_statistics(names=[USVC_NAME])
# Define a function to handle processing of input for the microservice.
# Its input and output data types must comply with the registered ones above.
async def process(input: Union[EmbedDoc, EmbedDocList], request: Request) -> SearchedDoc:
    start = time.time()

    vector = []
    if isinstance(input, EmbedDocList):
        logger.warning("Only one document is allowed for retrieval. Using the first document.")
        vector = input.docs[0] # EmbedDocList[0]
    else:
        vector = input # EmbedDoc

    req_data = await request.json()
    apply_hybrid_search_defaults(vector, req_data)

    logger.info(f"Retrieving documents for input: {vector.text}. K={vector.k}, Search Type={vector.search_type}")

    search_by = retriever.generate_search_by(req_data)
    rbac_by = retriever.generate_rbac(request.headers.get("Authorization")) if retriever.rbac_enabled else None
    
    # Analyze query to extract metadata constraints for filtering
    query_analysis = await retriever.analyze_query(
        vector.text,
        metadata_extraction_mode=vector.metadata_extraction_mode
    )
    metadata_filter = retriever.filter_expression_from_query_analysis(query_analysis)
    
    if query_analysis and query_analysis.has_filters:
        logger.info(f"Query analysis: {query_analysis.extraction_count} metadata filters extracted in {query_analysis.latency_ms:.2f}ms")
    
    result_vectors = None
    try:
        result_vectors = await retriever.retrieve(
            input=vector, search_by=search_by, rbac_by=rbac_by,
            metadata_filter=metadata_filter
        )
    except ValueError as e:
        logger.exception(f"A ValueError occured while validating the input in retriever: {str(e)}")
        raise HTTPException(status_code=400,
                            detail=f"A ValueError occured while validating the input in retriever: {str(e)}"
        )
    except NotImplementedError as e:
        logger.exception(f"A NotImplementedError occured in retriever: {str(e)}")
        raise HTTPException(status_code=501,
                            detail=f"A NotImplementedError occured in retriever: {str(e)}"
        )
    except Exception as e:
        logger.exception(f"An Error occured while retrieving documents: {str(e)}")
        raise HTTPException(status_code=500, detail=f"An Error while retrieving documents. {e}")

    statistics_dict[USVC_NAME].append_latency(time.time() - start, None)
    logger.info(f"Retrieved {len(result_vectors.retrieved_docs)} documents in {time.time() - start} seconds.")

    for doc in result_vectors.retrieved_docs:
        # A chunk found only by the BM25 leg of hybrid search has no vector distance.
        score = doc.metadata.get('rrf_score', doc.metadata.get('vector_distance', 'n/a'))
        if 'file_id' in doc.metadata:
            logger.debug(f"Score: {score} - File: {doc.metadata['file_id']} - Text: {doc.text[0:32]}...")

        if 'link_id' in doc.metadata:
            logger.debug(f"Score: {score} - Link: {doc.metadata['link_id']} - Text: {doc.text[0:32]}...")

    result_vectors.history_id = input.history_id
    return result_vectors


if __name__ == "__main__":
    erag_microservices[USVC_NAME].start()
