# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import pytest
from unittest import mock
from comps.cores.proto.docarray import EmbedDoc, EmbedDocList
from comps.ingestion.utils.erag_ingestion import EragIngestion

@pytest.fixture
def mock_vectorstore():
    class SearchRes:
        def __init__(self, content=""):
            self.page_content = content
    class MockDbClient:
        def __init__(self, *args, **kwargs):
            pass
        def add_texts(texts, **kwargs):
            return texts
        def similarity_search_by_vector(**kwargs):
            return [SearchRes('a'), SearchRes('b')]
    with mock.patch('comps.vectorstores.utils.connectors.connector_redis.ConnectorRedis', return_value=MockDbClient):
        yield

@pytest.mark.skip(reason="stale test: MockDbClient no longer matches the vectorstore API")
async def test_ingest_multiple_docs(mock_vectorstore):
    docs = [
        EmbedDoc(text="doc1", embedding=[1,2,3]),
        EmbedDoc(text="doc2", embedding=[1,2,3])
    ]
    input_docs = EmbedDocList(docs=docs)
    ingestion = EragIngestion("redis")
    result = await ingestion.ingest(input_docs)

    assert len(result.docs) == 2

@pytest.mark.skip(reason="stale test: MockDbClient no longer matches the vectorstore API")
async def test_ingest_single_docs(mock_vectorstore):
    doc = EmbedDoc(text="doc1", embedding=[1,2,3])

    input_docs = EmbedDocList(docs=[doc])
    ingestion = EragIngestion("redis")
    result = await ingestion.ingest(input_docs)

    assert isinstance(result.docs[0], EmbedDoc)
    assert result.docs[0].text == "doc1"
