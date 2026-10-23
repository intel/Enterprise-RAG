# ruff: noqa: E711, E712
# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0
# test_embedding_connectors.py

from typing import List
from unittest import mock
from unittest.mock import MagicMock

import pytest
from docarray import BaseDoc

from comps.embeddings.utils.connectors.connector import EmbeddingConnector
from comps.embeddings.utils.connectors.ovms_connector import OVMSConnector, OVMSEndpointEmbeddings
from comps.embeddings.utils.connectors.vllm_connector import VLLMConnector

def clean_singleton():
    OVMSConnector._instance = None
    VLLMConnector._instance = None

class MockEmbeddingConnector(EmbeddingConnector):
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [[0.1, 0.2, 0.3] for _ in texts]

    def embed_query(self, input_text: str) -> BaseDoc:
        mock_doc = MagicMock(spec=BaseDoc)
        mock_doc.embedding = [0.1, 0.2, 0.3]
        return mock_doc

def test_embed_query_valid_input():
    connector = MockEmbeddingConnector("model", "endpoint")
    result = connector.embed_query("test query")
    assert isinstance(result, BaseDoc)
    assert result.embedding == [0.1, 0.2, 0.3]

def test_embed_query_empty_string():
    connector = MockEmbeddingConnector("model", "endpoint")
    result = connector.embed_query("")
    assert isinstance(result, BaseDoc)
    assert result.embedding == [0.1, 0.2, 0.3]

def test_EmbeddingConnector_not_implemented():
    with pytest.raises(TypeError):
        EmbeddingConnector("model", "endpoint")

# The connectors are built in sync fixtures on purpose: _initialize() calls
# asyncio.run(), which fails if the async test body's event loop is already running.
@pytest.fixture
def vllm_connector():
    with mock.patch.object(VLLMConnector, '_validate', new=mock.AsyncMock(return_value=None)):
        yield VLLMConnector("test_model", "http://test-endpoint")
    clean_singleton()


@pytest.fixture
def ovms_connector():
    # OVMSEndpointEmbeddings refuses a URL as `model`, so the embedder is stubbed out.
    with mock.patch.object(OVMSConnector, '_validate', new=mock.AsyncMock(return_value=None)), \
         mock.patch.object(OVMSConnector, '_select_embedder',
                           return_value=MagicMock(model_name="test_model")):
        yield OVMSConnector("test_model", "http://test-endpoint")
    clean_singleton()


@pytest.mark.asyncio
async def test_vllm_connector_rejects_return_pooling(vllm_connector):
    """vLLM returns a single vector per input, so pooling must raise instead of degrading silently."""
    with pytest.raises(ValueError) as exc_info:
        await vllm_connector.embed_documents(["document1"], return_pooling=True)

    assert "return_pooling is not supported" in str(exc_info.value)


@pytest.mark.asyncio
async def test_ovms_connector_rejects_return_pooling(ovms_connector):
    """OVMS mean-pools its token embeddings, so pooling must raise instead of degrading silently."""
    with pytest.raises(ValueError) as exc_info:
        await ovms_connector.embed_documents(["document1"], return_pooling=True)

    assert "return_pooling is not supported" in str(exc_info.value)
