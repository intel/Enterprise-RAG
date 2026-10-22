# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

from unittest.mock import AsyncMock, patch
from comps.cores.proto.docarray import EmbedDoc, EmbedDocList, SearchedDoc, TextDoc
from comps.retrievers.utils.erag_retriever import EragRetriever
import pytest
from comps.cores.utils.utils import sanitize_env
import os


def test_decorator(*args, **kwargs):
    def decorator(func):
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)
        return wrapper
    return decorator

@pytest.mark.asyncio
@patch('comps.cores.mega.micro_service.register_microservice', new=test_decorator)
async def test_call_process_normal_retriever_rbac_enabled():
    with patch.dict("os.environ", {"VECTOR_STORE": "redis", "VECTOR_DB_RBAC": "true"}):
        with patch('comps.cores.mega.micro_service.register_microservice', new=test_decorator):
            EragRetriever._instance = None  # Reset the singleton instance for testing
            with patch('comps.retrievers.erag_retriever_microservice.retriever', new=EragRetriever(
                vector_store=sanitize_env(os.getenv("VECTOR_STORE")),
                rbac_enabled=str(os.getenv('VECTOR_DB_RBAC')).lower() in ['true', '1', 't', 'y', 'yes']
            )):
                with patch('comps.retrievers.erag_retriever_microservice.retriever.retrieve', side_effect=[SearchedDoc(retrieved_docs=[
                    TextDoc(text="aaa", metadata={
                        "doc_id": "123",
                        "page": 1,
                        "file_id": "456",
                        "vector_distance": 0.9
                    })], user_prompt="")]):
                    with patch('comps.retrievers.erag_retriever_microservice.retriever.generate_rbac') as mock_generate_rbac:
                        from comps.retrievers.erag_retriever_microservice import process, retriever

                        embeddoc = EmbedDoc(
                            text="Test document",
                            embedding=[0.1, 0.2, 0.3]
                        )

                        embeddocs = EmbedDocList(docs=[embeddoc, embeddoc])

                        # Call the undecorated process function
                        # Call the process function
                        mock_request = AsyncMock()
                        mock_request.headers = {"Authorization": "abcd"}
                        result = await process(input=embeddocs, request=mock_request)

                        # Assert that generate_rbac was called
                        assert retriever.rbac_enabled is True
                        mock_generate_rbac.assert_called_once()

                        # Assert that the result is of the expected type
                        assert isinstance(result, SearchedDoc)
                        assert len(result.retrieved_docs) == 1

@pytest.mark.asyncio
@patch('comps.cores.mega.micro_service.register_microservice', new=test_decorator)
async def test_call_process_normal_retriever_rbac_disabled():
    with patch.dict("os.environ", {"VECTOR_STORE": "redis", "VECTOR_DB_RBAC": "false"}):
        with patch('comps.cores.mega.micro_service.register_microservice', new=test_decorator):
            EragRetriever._instance = None  # Reset the singleton instance for testing
            with patch('comps.retrievers.erag_retriever_microservice.retriever', new=EragRetriever(
                vector_store=sanitize_env(os.getenv("VECTOR_STORE")),
                rbac_enabled=str(os.getenv('VECTOR_DB_RBAC')).lower() in ['true', '1', 't', 'y', 'yes']
            )):
                with patch('comps.retrievers.erag_retriever_microservice.retriever.retrieve', side_effect=[SearchedDoc(retrieved_docs=[
                    TextDoc(text="aaa", metadata={
                        "doc_id": "123",
                        "page": 1,
                        "file_id": "456",
                        "vector_distance": 0.9
                    })], user_prompt="")]):
                    with patch('comps.retrievers.erag_retriever_microservice.retriever.generate_rbac') as mock_generate_rbac:
                        from comps.retrievers.erag_retriever_microservice import process, retriever

                        embeddoc = EmbedDoc(
                            text="Test document",
                            embedding=[0.1, 0.2, 0.3]
                        )

                        embeddocs = EmbedDocList(docs=[embeddoc, embeddoc])

                        # Call the undecorated process function
                        # Call the process function
                        mock_request = AsyncMock()
                        mock_request.headers = {"Authorization": "abcd"}
                        result = await process(input=embeddocs, request=mock_request)

                        # Assert that generate_rbac was called
                        assert retriever.rbac_enabled is False
                        mock_generate_rbac.assert_not_called()

                        # Assert that the result is of the expected type
                        assert isinstance(result, SearchedDoc)
                        assert len(result.retrieved_docs) == 1

@pytest.mark.asyncio
@patch('comps.cores.mega.micro_service.register_microservice', new=test_decorator)
async def test_call_process_normal_retriever_multiple_embeddocs():
    with patch.dict("os.environ", {"VECTOR_STORE": "redis", "VECTOR_DB_RBAC": "false"}):
        with patch('comps.cores.mega.micro_service.register_microservice', new=test_decorator):
            with patch('comps.retrievers.erag_retriever_microservice.retriever', new=EragRetriever(
                vector_store=sanitize_env(os.getenv("VECTOR_STORE")),
                rbac_enabled=False
            )):
                with patch('comps.retrievers.erag_retriever_microservice.retriever.retrieve', side_effect=[SearchedDoc(retrieved_docs=[
                    TextDoc(text="aaa", metadata={
                        "doc_id": "123",
                        "page": 1,
                        "file_id": "456",
                        "vector_distance": 0.9
                    }),
                    TextDoc(text="aaa", metadata={
                        "doc_id": "123",
                        "page": 1,
                        "link_id": "https://example.com/link",
                        "vector_distance": 0.9
                    })
                ], user_prompt="")]):
                    from comps.retrievers.erag_retriever_microservice import process

                    embeddoc = EmbedDoc(
                        text="Test document",
                        embedding=[0.1, 0.2, 0.3]
                    )

                    embeddocs = EmbedDocList(docs=[embeddoc, embeddoc])

                    # Call the undecorated process function
                    result = await process(input=embeddocs, request=AsyncMock())

                    # Assert that the result is of the expected type
                    assert isinstance(result, SearchedDoc)
                    assert len(result.retrieved_docs) == 2

@pytest.mark.asyncio
@patch('comps.cores.mega.micro_service.register_microservice', new=test_decorator)
async def test_call_process_normal_retriever():
    with patch.dict("os.environ", {"VECTOR_STORE": "redis", "VECTOR_DB_RBAC": "false"}):
        with patch('comps.cores.mega.micro_service.register_microservice', new=test_decorator):
            with patch('comps.retrievers.erag_retriever_microservice.retriever', new=EragRetriever(
                vector_store=sanitize_env(os.getenv("VECTOR_STORE")),
                rbac_enabled=False
            )):
                with patch('comps.retrievers.erag_retriever_microservice.retriever.retrieve', side_effect=[SearchedDoc(retrieved_docs=[
                    TextDoc(text="aaa", metadata={
                        "doc_id": "123",
                        "page": 1,
                        "file_id": "456",
                        "vector_distance": 0.9
                    }),
                    TextDoc(text="aaa", metadata={
                        "doc_id": "123",
                        "page": 1,
                        "link_id": "https://example.com/link",
                        "vector_distance": 0.9
                    })
                ], user_prompt="")]):
                    from comps.retrievers.erag_retriever_microservice import process

                    embeddoc = EmbedDoc(
                        text="Test document",
                        embedding=[0.1, 0.2, 0.3]
                    )

                    # Call the undecorated process function
                    result = await process(input=embeddoc, request=AsyncMock())

                    # Assert that the result is of the expected type
                    assert isinstance(result, SearchedDoc)
                    assert len(result.retrieved_docs) == 2



# ---------------------------------------------------------------------------
# Hybrid search defaults (contextual BM25 + contextual embeddings fused with RRF).
# The retriever is deployed with HYBRID_SEARCH_ENABLED=True whenever contextual RAG is
# enabled, which turns plain "similarity" requests into "hybrid" ones.
# ---------------------------------------------------------------------------

HYBRID_ENV = {
    "HYBRID_SEARCH_CANDIDATE_K": "100",
    "HYBRID_SEARCH_RESULT_K": "20",
    "HYBRID_SEARCH_RRF_K": "0",
    "HYBRID_SEARCH_SEMANTIC_WEIGHT": "0.8",
    "HYBRID_SEARCH_BM25_WEIGHT": "0.2",
}


@pytest.fixture
def usvc():
    with patch.dict("os.environ", {"VECTOR_STORE": "redis", "VECTOR_DB_RBAC": "false"}):
        import comps.retrievers.erag_retriever_microservice as module
        yield module


def _embed_doc(**kwargs):
    return EmbedDoc(text="Test document", embedding=[0.1, 0.2, 0.3], **kwargs)


def test_hybrid_defaults_upgrade_similarity_requests(usvc):
    with patch.object(usvc, "HYBRID_SEARCH_ENABLED", True), patch.dict("os.environ", HYBRID_ENV):
        doc = _embed_doc()
        assert doc.search_type == "similarity"

        usvc.apply_hybrid_search_defaults(doc, {"text": "Test document"})

        assert doc.search_type == "hybrid"
        assert doc.hybrid_candidate_k == 100
        assert doc.hybrid_result_k == 20
        assert doc.rrf_k == 0
        assert doc.semantic_weight == 0.8
        assert doc.bm25_weight == 0.2


def test_hybrid_defaults_are_not_applied_when_the_flag_is_off(usvc):
    with patch.object(usvc, "HYBRID_SEARCH_ENABLED", False), patch.dict("os.environ", HYBRID_ENV):
        doc = _embed_doc()
        usvc.apply_hybrid_search_defaults(doc, {"text": "Test document"})
        assert doc.search_type == "similarity"


def test_search_type_vector_is_never_upgraded(usvc):
    # The documented escape hatch for forcing dense-only retrieval on a hybrid deployment.
    with patch.object(usvc, "HYBRID_SEARCH_ENABLED", True), patch.dict("os.environ", HYBRID_ENV):
        doc = _embed_doc(search_type="vector")
        usvc.apply_hybrid_search_defaults(doc, {"text": "Test document", "search_type": "vector"})
        assert doc.search_type == "vector"


def test_explicit_request_parameters_win_over_env_defaults(usvc):
    with patch.object(usvc, "HYBRID_SEARCH_ENABLED", True), patch.dict("os.environ", HYBRID_ENV):
        doc = _embed_doc(rrf_k=60, semantic_weight=0.5)
        usvc.apply_hybrid_search_defaults(
            doc, {"text": "Test document", "rrf_k": 60, "semantic_weight": 0.5}
        )
        assert doc.rrf_k == 60
        assert doc.semantic_weight == 0.5
        assert doc.bm25_weight == 0.2       # not sent by the caller -> env default applies
        assert doc.hybrid_candidate_k == 100


def test_hybrid_defaults_read_parameters_from_an_embeddoclist_body(usvc):
    # The pipeline posts an EmbedDocList; the parameters live in docs[0].
    with patch.object(usvc, "HYBRID_SEARCH_ENABLED", True), patch.dict("os.environ", HYBRID_ENV):
        doc = _embed_doc(hybrid_candidate_k=30)
        usvc.apply_hybrid_search_defaults(
            doc, {"docs": [{"text": "Test document", "hybrid_candidate_k": 30}]}
        )
        assert doc.search_type == "hybrid"
        assert doc.hybrid_candidate_k == 30
        assert doc.rrf_k == 0


def test_invalid_env_default_is_ignored(usvc):
    with patch.object(usvc, "HYBRID_SEARCH_ENABLED", True), \
         patch.dict("os.environ", {**HYBRID_ENV, "HYBRID_SEARCH_CANDIDATE_K": "not-a-number"}):
        doc = _embed_doc()
        usvc.apply_hybrid_search_defaults(doc, {"text": "Test document"})
        assert doc.hybrid_candidate_k == 100  # model default kept, request still served
        assert doc.search_type == "hybrid"


@pytest.mark.asyncio
@patch('comps.cores.mega.micro_service.register_microservice', new=test_decorator)
async def test_call_process_serves_a_similarity_request_as_hybrid():
    with patch.dict("os.environ", {**HYBRID_ENV, "VECTOR_STORE": "redis",
                                   "VECTOR_DB_RBAC": "false"}):
        EragRetriever._instance = None
        with patch('comps.retrievers.erag_retriever_microservice.retriever', new=EragRetriever(
            vector_store=sanitize_env(os.getenv("VECTOR_STORE")), rbac_enabled=False
        )):
            import comps.retrievers.erag_retriever_microservice as module
            with patch.object(module, "HYBRID_SEARCH_ENABLED", True), \
                 patch.object(module.retriever, "retrieve", side_effect=[SearchedDoc(
                     retrieved_docs=[TextDoc(text="aaa", metadata={
                         # A chunk the BM25 leg found on its own has no vector_distance,
                         # so the response logging must not assume one is present.
                         "doc_id": "123", "rrf_score": 0.2, "retrieval_source": "bm25",
                         "bm25_rank": 1,
                     })], user_prompt="")]) as mock_retrieve:
                mock_request = AsyncMock()
                mock_request.headers = {}
                mock_request.json.return_value = {"text": "Test document"}

                result = await module.process(input=_embed_doc(), request=mock_request)

                assert isinstance(result, SearchedDoc)
                assert len(result.retrieved_docs) == 1
                # The EmbedDoc handed to the retriever was upgraded in place.
                assert mock_retrieve.call_args.kwargs["input"].search_type == "hybrid"
        EragRetriever._instance = None
