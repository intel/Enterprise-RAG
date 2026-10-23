# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import importlib
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from comps.contextual_rag.utils.erag_contextual_rag import EragContextualRag
from comps.cores.proto.docarray import ContextualRagInput, TextDoc, TextDocList


"""
To execute these tests with coverage report, navigate to the `src` folder and run the following command:
   pytest --disable-warnings --cov=comps/contextual_rag --cov-report=term --cov-report=html tests/unit/contextual_rag/test_erag_contextual_rag_microservice.py

Alternatively, to run all tests for the 'contextual_rag' module, execute the following command:
   pytest --disable-warnings --cov=comps/contextual_rag --cov-report=term --cov-report=html tests/unit/contextual_rag
"""

# Both are mandatory and the .env ships them empty on purpose: the LLM is deployed
# separately (deployment/models.yaml), so there is no address that could be defaulted.
CONTEXTUAL_RAG_ENV = {
    "VLLM_SERVER_ENDPOINT": "http://blurb-model:8000",
    "CONTEXT_MODEL_NAME": "qwen3-4b-w8a8-blurb",
}


@pytest.fixture
def mock_cores_mega_microservice():
    with patch('comps.cores.mega.micro_service.register_microservice') as mock_register, \
         patch('comps.cores.mega.micro_service.erag_microservices', {}):
        mock_register.return_value = lambda func: func  # decorator passthrough
        yield mock_register


@pytest.fixture
def mock_erag_contextual_rag_run():
    with patch.object(EragContextualRag, 'run', return_value=TextDocList(docs=[])) as mock:
        yield mock


@pytest.fixture
def usvc(mock_cores_mega_microservice, mock_erag_contextual_rag_run):
    """The microservice module, imported with a usable blurb-model configuration."""
    with patch.dict("os.environ", CONTEXTUAL_RAG_ENV):
        import comps.contextual_rag.erag_contextual_rag_microservice as test_module
        importlib.reload(test_module)
        yield test_module


@pytest.fixture
def input_docs():
    return ContextualRagInput(
        docs=[TextDoc(text="Test chunk")],
        whole_document="Test chunk of a longer source document.",
        document_id="doc-1",
    )


class TestMicroserviceDeclaration:
    """Test microservice declaration and initialization."""

    @patch('dotenv.load_dotenv')
    def test_microservice_declaration_complies_with_guidelines(
        self, mock_load_dotenv, mock_cores_mega_microservice, mock_erag_contextual_rag_run
    ):
        """Test that microservice follows ERAG guidelines."""
        with patch.dict("os.environ", CONTEXTUAL_RAG_ENV):
            try:
                import comps.contextual_rag.erag_contextual_rag_microservice as test_module
                importlib.reload(test_module)
            except Exception as e:
                pytest.fail(f"ERAG Contextual RAG Microservice init raised {type(e).__name__} unexpectedly!")

        mock_load_dotenv.assert_called()
        called_path = mock_load_dotenv.call_args[0][0]
        expected_suffix = '/impl/microservice/.env'
        assert called_path.endswith(expected_suffix), \
            f"Expected load_dotenv to be called with a path ending in '{expected_suffix}', but got '{called_path}'"

        assert hasattr(test_module, 'USVC_NAME'), "USVC_NAME is not declared"
        assert hasattr(test_module, 'logger'), "logger is not declared"
        assert hasattr(test_module, 'register_microservice'), "register_microservice is not declared"
        assert hasattr(test_module, 'statistics_dict'), "statistics_dict is not declared"
        assert hasattr(test_module, 'process'), "process is not declared"


class TestMicroserviceInitialization:
    """Test microservice initialization with various configurations."""

    def test_initialization_succeeds_with_the_blurb_model_configured(self, usvc):
        assert usvc.erag_contextual_rag is not None
        assert usvc.erag_contextual_rag._base_url == "http://blurb-model:8000"
        assert usvc.erag_contextual_rag._model == "qwen3-4b-w8a8-blurb"

    def test_prompt_budget_defaults_to_16384_tokens(self, usvc):
        assert usvc.erag_contextual_rag._max_prompt_tokens == 16384

    def test_initialization_fails_without_a_blurb_endpoint(
        self, mock_cores_mega_microservice, mock_erag_contextual_rag_run
    ):
        # Failing at start-up is deliberate: the alternative is a running service that
        # silently contextualises nothing.
        with patch.dict("os.environ", {"VLLM_SERVER_ENDPOINT": "", "CONTEXT_MODEL_NAME": "some-model"}):
            import comps.contextual_rag.erag_contextual_rag_microservice as test_module
            with pytest.raises(ValueError):
                importlib.reload(test_module)

    def test_initialization_fails_without_a_blurb_model_name(
        self, mock_cores_mega_microservice, mock_erag_contextual_rag_run
    ):
        with patch.dict("os.environ", {**CONTEXTUAL_RAG_ENV, "CONTEXT_MODEL_NAME": ""}):
            import comps.contextual_rag.erag_contextual_rag_microservice as test_module
            with pytest.raises(ValueError):
                importlib.reload(test_module)

    def test_tuning_environment_reaches_the_service(
        self, mock_cores_mega_microservice, mock_erag_contextual_rag_run
    ):
        with patch.dict("os.environ", {
            **CONTEXTUAL_RAG_ENV,
            "MAX_NEW_TOKENS": "64",
            "CONTEXT_MAX_CONCURRENCY": "8",
            "CONTEXT_MAX_PROMPT_TOKENS": "4096",
            "CONTEXT_MAX_RETRIES": "0",
            "CONTEXT_STICKY_ROUTING": "false",
        }):
            import comps.contextual_rag.erag_contextual_rag_microservice as test_module
            importlib.reload(test_module)

            service = test_module.erag_contextual_rag
            assert service._max_new_tokens == 64
            assert service._max_concurrency == 8
            assert service._max_prompt_tokens == 4096
            assert service._max_retries == 0
            assert service._sticky is False


class TestProcessFunction:
    """Test the process function."""

    def test_process_succeeds(self, usvc, input_docs, mock_erag_contextual_rag_run):
        expected = TextDocList(docs=[TextDoc(text="CONTEXT\n\nTest chunk")])
        mock_erag_contextual_rag_run.return_value = expected

        response = usvc.process(input_docs)

        assert response == expected
        assert usvc.USVC_NAME in usvc.statistics_dict.keys(), \
            f"statistics_dict does not have an entry for the microservice {usvc.USVC_NAME}"

    def test_process_reports_a_configuration_error_as_bad_request(
        self, usvc, input_docs, mock_erag_contextual_rag_run
    ):
        # A document that cannot be made to fit the served context window is the caller's
        # problem, not a server fault.
        mock_erag_contextual_rag_run.side_effect = ValueError("prompt does not fit")
        with pytest.raises(HTTPException) as excinfo:
            usvc.process(input_docs)
        assert excinfo.value.status_code == 400

    def test_process_reports_an_unexpected_error_as_server_error(
        self, usvc, input_docs, mock_erag_contextual_rag_run
    ):
        mock_erag_contextual_rag_run.side_effect = RuntimeError("boom")
        with pytest.raises(HTTPException) as excinfo:
            usvc.process(input_docs)
        assert excinfo.value.status_code == 500
