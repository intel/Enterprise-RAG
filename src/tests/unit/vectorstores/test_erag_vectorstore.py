# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import logging
import pytest
from unittest import mock
from unittest.mock import patch
from comps.cores.proto.docarray import DocList,EmbedDoc, SearchedDoc, TextDoc
from comps.vectorstores.utils.erag_vectorstore import EragVectorStore

@pytest.fixture
def reset_singleton():
    EragVectorStore._instance = None
    yield
    EragVectorStore._instance = None

@pytest.fixture
def vectorstore_instance(vector_store_name="redis"):
    EragVectorStore._instance = None
    return EragVectorStore(vector_store_name=vector_store_name)

@pytest.fixture
def mock_redis_vectorstore():
    with mock.patch('comps.vectorstores.utils.connectors.connector_redis.ConnectorRedis', autospec=True) as MockClass:
        mock_instance = MockClass.return_value
        #mock_instance.add_texts = ['a', 'b', 'c']
        mock_instance.search = SearchedDoc(
            user_prompt='Hello?',
            retrieved_docs=DocList(docs=[
                TextDoc(text='Hello, how are you?'),
                TextDoc(text='Hello, I am fine.')
            ])
        )
        yield MockClass

def test_singleton_behavior(mock_redis_vectorstore):
    instance1 = EragVectorStore("redis")
    instance2 = EragVectorStore("redis")
    assert instance1 is instance2
    EragVectorStore._instance = None

def test_initialize_method(mock_redis_vectorstore):
    stores = EragVectorStore("redis")._SUPPORTED_VECTOR_STORES.keys()
    for store in stores:
        vectorstore = EragVectorStore(store)
        assert vectorstore._vector_store_name is not None
        assert isinstance(vectorstore.vector_store, mock_redis_vectorstore.return_value.__class__)

# def test_initialize_method_with_unsupported_store(vectorstore_instance, caplog):
#     with caplog.at_level(logging.ERROR):
#             vectorstore_instance._initialize(vector_store_name="unsupported")
#             assert "Unsupported vector store" in caplog.text

@patch('comps.vectorstores.utils.erag_vectorstore.EragVectorStore.add_texts')
def test_add_texts_method(mock_add_texts):
    vectorstore = EragVectorStore("redis")
    input_texts = [
        EmbedDoc(text='Hello, how are you?', embedding=[0.1, 0.2, 0.3]),
        EmbedDoc(text='Hello, I am fine', embedding=[0.4, 0.5, 0.6]),
    ]
    vectorstore.add_texts(input=input_texts)
    mock_add_texts.assert_called_once_with(input=input_texts)

@patch('comps.vectorstores.utils.erag_vectorstore.EragVectorStore.search')
def test_search_method(mock_search):
    vectorstore = EragVectorStore("redis")
    search_text = EmbedDoc(text='Hello, how are you?', embedding=[0.1, 0.2, 0.3])
    vectorstore.search(input=search_text)
    mock_search.assert_called_once_with(input=search_text)

def test_search_types(mock_redis_vectorstore):
    types = ['similarity', 'similarity_search_with_siblings', 'similarity_distance_threshold', 'mmr']
    search_text = EmbedDoc(text='Hello, how are you?', embedding=[0.1, 0.2, 0.3])

    for type in types:
        search_text.search_type = type
        if type == 'similarity_distance_threshold':
            search_text.distance_threshold = 0.5

def test_import_redis_success():
    vectorstore_instance = EragVectorStore("redis")
    with mock.patch('comps.vectorstores.utils.connectors.connector_redis.ConnectorRedis', autospec=True) as MockConnectorRedis:
        vectorstore_instance._import_redis()
        assert isinstance(vectorstore_instance.vector_store, MockConnectorRedis.__class__)

def test_import_redis_failure(caplog):
    with mock.patch('comps.vectorstores.utils.connectors.connector_redis', side_effect=ModuleNotFoundError) as MockConnectorRedis:
        with caplog.at_level(logging.ERROR):
            with pytest.raises(ModuleNotFoundError):
                MockConnectorRedis("redis")
                assert "exception when loading ConnectorRedis" in caplog.text
                assert MockConnectorRedis.vector_store is None

# ---------------------------------------------------------------------------
# Hybrid search dispatch
# ---------------------------------------------------------------------------

def test_search_type_hybrid_dispatches_to_hybrid_search_by_vector():
    EragVectorStore._instance = None
    vectorstore = EragVectorStore("redis")
    with mock.patch.object(vectorstore.vector_store, 'hybrid_search_by_vector') as mock_hybrid:
        search_text = EmbedDoc(
            text='Hello, how are you?',
            embedding=[0.1, 0.2, 0.3],
            search_type='hybrid',
            k=10
        )
        vectorstore.search(input=search_text)

        kwargs = mock_hybrid.call_args.kwargs
        assert kwargs['input_text'] == 'Hello, how are you?'
        # Model defaults: 100 candidates per leg, 0.8/0.2 weighting and Anthropic's
        # weight/rank fusion (rrf_k=0).
        assert kwargs['candidate_k'] == 100
        assert kwargs['semantic_weight'] == 0.8
        assert kwargs['bm25_weight'] == 0.2
        assert kwargs['rrf_k'] == 0
        # The fused list handed downstream is deeper than k -- the reranker is what cuts it.
        assert kwargs['k'] == 20
    EragVectorStore._instance = None

def test_search_type_hybrid_never_returns_fewer_than_k():
    EragVectorStore._instance = None
    vectorstore = EragVectorStore("redis")
    with mock.patch.object(vectorstore.vector_store, 'hybrid_search_by_vector') as mock_hybrid:
        vectorstore.search(input=EmbedDoc(
            text='Hello?', embedding=[0.1], search_type='hybrid', k=80, hybrid_result_k=50
        ))
        assert mock_hybrid.call_args.kwargs['k'] == 80
    EragVectorStore._instance = None

def test_search_type_bm25_dispatches_to_bm25_search():
    EragVectorStore._instance = None
    vectorstore = EragVectorStore("redis")
    with mock.patch.object(vectorstore.vector_store, 'bm25_search') as mock_bm25:
        vectorstore.search(input=EmbedDoc(
            text='Hello?', embedding=[0.1], search_type='bm25', k=10
        ))
        kwargs = mock_bm25.call_args.kwargs
        assert kwargs['input_text'] == 'Hello?'
        # Same depth as the fused list: max(k, hybrid_result_k).
        assert kwargs['k'] == 20
    EragVectorStore._instance = None

def test_search_type_vector_stays_dense_only():
    EragVectorStore._instance = None
    vectorstore = EragVectorStore("redis")
    with mock.patch.object(vectorstore.vector_store, 'similarity_search_by_vector') as mock_dense, \
         mock.patch.object(vectorstore.vector_store, 'hybrid_search_by_vector') as mock_hybrid:
        vectorstore.search(input=EmbedDoc(
            text='Hello?', embedding=[0.1], search_type='vector', k=10
        ))
        mock_dense.assert_called_once()
        mock_hybrid.assert_not_called()
    EragVectorStore._instance = None
