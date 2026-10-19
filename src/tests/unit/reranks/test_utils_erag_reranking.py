# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

from unittest.mock import patch  #, AsyncMock

import pytest

from comps.cores.proto.docarray import SearchedDoc, TextDoc
from comps.reranks.utils.erag_reranking import EragReranker

"""
To execute these tests with coverage report, navigate to the `src` folder and run the following command:
   pytest --disable-warnings --cov=comps/reranks --cov-report=term --cov-report=html tests/unit/reranks/test_utils_erag_reranking.py

Alternatively, to run all tests for the 'reranks' module, execute the following command:
   pytest --disable-warnings --cov=comps/reranks --cov-report=term --cov-report=html tests/unit/reranks
"""

@pytest.fixture
def test_class():
    """Fixture to create EragReranker instance."""
    with patch.object(EragReranker, '_validate', return_value='Mocked Method'):
        return EragReranker(service_endpoint="http:/test:1234", model_server="vllm",
                            model_name="BAAI/bge-reranker-v2-m3", late_chunking_enabled=False)

@pytest.fixture
def mock_input_data():
    """Fixture to provide mock input data."""
    return SearchedDoc(
        user_prompt="This is my sample query?",
        retrieved_docs=[
            TextDoc(text="Document 1"),
            TextDoc(text="Document 2"),
            TextDoc(text="Document 3"),
        ],
        top_n=1,
    )

@pytest.fixture
def mock_response_data():
    """Fixture to provide mock response data in the vLLM /score response shape."""
    return {
        "data": [
            {"index": 1, "score": 0.9988041},
            {"index": 0, "score": 0.02294873},
            {"index": 2, "score": 0.5294873},
        ]
    }

def test_initialization_succeeds_with_valid_params():
    # Assert that the instance is created successfully
    with patch.object(EragReranker, '_validate', return_value='Mocked Method'):
        assert isinstance(EragReranker(service_endpoint="http:/test:1234/reranks", model_server="vllm"), EragReranker), "Instance was not created successfully."


def test_initializaction_raises_exception_when_missing_required_arg():
    # nothing is passed
    with pytest.raises(Exception) as context:
        EragReranker()

    assert str(context.value).endswith("missing 2 required positional arguments: 'service_endpoint' and 'model_server'")

    # empty string is passed to trigger validation
    with pytest.raises(ValueError) as context:
        EragReranker(service_endpoint="",  model_server="vllm", late_chunking_enabled=False)

    assert str(context.value) == "The 'RERANKING_SERVICE_ENDPOINT' cannot be empty."

def test_initializaction_raises_exception_when_incorrect_model_server():
    # wrong model server is passed
    with pytest.raises(ValueError) as context:
        EragReranker(service_endpoint="http://127.0.0.1:8090",  model_server="te")

    assert "Unsupported model server" in str(context.value)

def test_reranker_filter_top_n(test_class):
    scores = [{"index": 1, "score": 0.9988041}, {"index": 0, "score": 0.02294873}, {"index": 2, "score": 0.5294873}]
    top_n = 1
    output = test_class._filter_top_n(top_n, scores)

    assert len(output) == 1, "The output should contain only 1 element"
    assert output[0]["index"] == 1, "The output should contain the element with the highest score"
    assert output[0]["score"] == 0.9988041, "The output should contain the element with the highest score"

def test_reranker_filter_top_n_with_score_threshold(test_class):
    scores = [{"index": 1, "score": 0.9988041}, {"index": 0, "score": 0.02294873}, {"index": 2, "score": 0.5294873}]
    top_n = 3
    score_threshold = 0.1
    output = test_class._filter_top_n(top_n, scores, score_threshold)

    assert len(output) == 2, "The output should contain only 1 element"
    assert output[0]["index"] == 1, "The output should contain the element with the highest score"
    assert output[0]["score"] == 0.9988041, "The output should contain the element with the highest score"
    assert output[1]["index"] == 2, "The output should contain the element with the second highest score"
    assert output[1]["score"] == 0.5294873, "The output should contain the element with the second highest score"

@pytest.mark.asyncio
@patch("comps.reranks.utils.erag_reranking.aiohttp.ClientSession")
async def test_run_succeeds(mock_session_class, test_class, mock_input_data, mock_response_data):
    from unittest.mock import AsyncMock, MagicMock

    # Mock the response object
    mock_response = AsyncMock()
    mock_response.json = AsyncMock(return_value=mock_response_data)
    mock_response.raise_for_status = MagicMock(return_value=None)
    mock_response.__aenter__ = AsyncMock(return_value=mock_response)
    mock_response.__aexit__ = AsyncMock(return_value=False)

    # Mock the session object
    mock_session = AsyncMock()
    mock_session.post = MagicMock(return_value=mock_response)
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=False)

    # Mock the ClientSession class
    mock_session_class.return_value = mock_session

    # Call the method being tested
    result = await test_class.run(mock_input_data)

    # Assert that result.user_prompt is not empty
    assert result.data["user_prompt"], "Query is empty"

    # Assert that the reranked_docs list has only 1 element
    assert len(result.data["reranked_docs"]) == 1, "The reranked_docs list should have only 1 element as top_n=1 by default"

    # Check the value of the first item in the reranked_docs list
    # Index 1 from mock_response_data corresponds to "Document 2" which has the highest score (0.9988041)
    assert result.data["reranked_docs"][0].text == "Document 2", "The result reranked_docs should contain only the document with the highest score"


@pytest.mark.asyncio
@patch("comps.reranks.utils.erag_reranking.aiohttp.ClientSession")
async def test_run_succeeds_with_custom_top_N(mock_session_class, test_class, mock_input_data, mock_response_data):
    from unittest.mock import AsyncMock, MagicMock

    mock_input_data.top_n = 2  # Set top_n to 2

    # Mock the response object
    mock_response = AsyncMock()
    mock_response.json = AsyncMock(return_value=mock_response_data)
    mock_response.raise_for_status = MagicMock(return_value=None)
    mock_response.__aenter__ = AsyncMock(return_value=mock_response)
    mock_response.__aexit__ = AsyncMock(return_value=False)

    # Mock the session object
    mock_session = AsyncMock()
    mock_session.post = MagicMock(return_value=mock_response)
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=False)

    # Mock the ClientSession class
    mock_session_class.return_value = mock_session

    # Call the method being tested
    result = await test_class.run(mock_input_data)

    # Assert that result.query is not empty
    assert result.data["user_prompt"], "Query is empty"

    # Assert that the reranked_docs list has 2 elements
    assert len(result.data["reranked_docs"]) == 2, "The reranked_docs list should have 2 elements as top_n=2"

    # Check the values of the items in the reranked_docs list
    # mock_response_data is sorted by score: index 1 (0.9988041), index 2 (0.5294873), index 0 (0.02294873)
    # Index 1 = "Document 2", Index 2 = "Document 3"
    assert result.data["reranked_docs"][0].text == "Document 2", "The first document in reranked_docs should be 'Document 2'"
    assert result.data["reranked_docs"][1].text == "Document 3", "The second document in reranked_docs should be 'Document 3'"


@pytest.mark.asyncio
@patch("comps.reranks.utils.erag_reranking.aiohttp.ClientSession")
async def test_run_raises_exception_when_server_unavailable(mock_session_class, test_class, mock_input_data):
    from aiohttp.client_exceptions import ClientResponseError
    from unittest.mock import AsyncMock, MagicMock
    from yarl import URL

    # Create proper request_info mock
    mock_request_info = MagicMock()
    mock_request_info.real_url = URL("http://test:1234/rerank")

    # Mock the response object that raises an error
    mock_response = AsyncMock()
    mock_response.json = AsyncMock(return_value=[])
    mock_response.raise_for_status = MagicMock(side_effect=ClientResponseError(
        request_info=mock_request_info,
        history=(),
        status=404,
        message="Not Found"
    ))
    mock_response.__aenter__ = AsyncMock(return_value=mock_response)
    mock_response.__aexit__ = AsyncMock(return_value=False)

    # Mock the session object
    mock_session = AsyncMock()
    mock_session.post = MagicMock(return_value=mock_response)
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=False)

    # Mock the ClientSession class
    mock_session_class.return_value = mock_session

    with pytest.raises(ClientResponseError):
        await test_class.run(mock_input_data)


@pytest.mark.asyncio
@patch("comps.reranks.utils.erag_reranking.aiohttp.ClientSession")
async def test_call_reranker_raises_exception_when_server_is_unavailable(mock_session_class, test_class, mock_input_data):
    from aiohttp.client_exceptions import ClientResponseError
    from unittest.mock import AsyncMock, MagicMock
    from yarl import URL

    user_prompt = mock_input_data.user_prompt
    retrieved_docs = [doc.text for doc in mock_input_data.retrieved_docs]

    # Create proper request_info mock
    mock_request_info = MagicMock()
    mock_request_info.real_url = URL("http://test:1234/rerank")

    # Mock the response object that raises an error
    mock_response = AsyncMock()
    mock_response.json = AsyncMock(return_value=[])
    mock_response.raise_for_status = MagicMock(side_effect=ClientResponseError(
        request_info=mock_request_info,
        history=(),
        status=404,
        message="Not Found"
    ))
    mock_response.__aenter__ = AsyncMock(return_value=mock_response)
    mock_response.__aexit__ = AsyncMock(return_value=False)

    # Mock the session object
    mock_session = AsyncMock()
    mock_session.post = MagicMock(return_value=mock_response)
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=False)

    # Mock the ClientSession class
    mock_session_class.return_value = mock_session

    with pytest.raises(ClientResponseError):
        await test_class._async_call_reranker(user_prompt, retrieved_docs)


@pytest.mark.asyncio
async def test_run_fallbacks_to_user_prompt_if_no_retrieved_docs(test_class):
    input_data = SearchedDoc(
        user_prompt="This is my sample query?", retrieved_docs=[], top_n=1
    )

    result = await test_class.run(input_data)

    assert result.data["user_prompt"] == input_data.user_prompt, "Query does not match the user prompt as expected when no retrieved documents are provided"
    # Assert that the reranked_docs list is empty
    assert not result.data["reranked_docs"], "The reranked_docs list should be empty when no retrieved documents are provided"

@pytest.mark.asyncio
async def test_run_fallbacks_to_user_prompt_for_invalid_retrieved_docs(test_class):
    input_data = SearchedDoc(
        user_prompt="This is my sample query?",
        retrieved_docs=[
            TextDoc(text=""),  # empty text
            TextDoc(text="  "),  # tab
            TextDoc(text="  "),  # two spaces
        ],
        top_n=1,
    )

    result = await test_class.run(input_data)
    assert result.data["user_prompt"] == input_data.user_prompt, "Query does not match the user prompt as expected when the provided retrieved_docs are empty or invalid"
     # Assert that the reranked_docs list is empty
    assert not result.data["reranked_docs"], "The reranked_docs list should be empty when the provided retrieved_docs are empty or invalid"


@pytest.mark.asyncio
async def test_run_raises_exception_on_empty_user_prompt(test_class):
    input_data = SearchedDoc(
        user_prompt="",
        retrieved_docs=[
            TextDoc(text="Document 1"),
            TextDoc(text="Document 2"),
            TextDoc(text="Document 3"),
        ],
        top_n=1,
    )

    with pytest.raises(ValueError) as context:
        await test_class.run(input_data)

    assert str(context.value) == "Initial query cannot be empty."


@pytest.mark.asyncio(scope="module")
@patch("comps.reranks.utils.erag_reranking.aiohttp.ClientSession.post")
async def test_run_raises_exception_on_top_N_below_one(mock_post, test_class):
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as context:
        input_data = SearchedDoc(
            user_prompt="This is my sample query?",
            retrieved_docs=[
                TextDoc(text="Document 1"),
                TextDoc(text="Document 2"),
                TextDoc(text="Document 3"),
            ],
            top_n=-1,
        )

        await test_class.run(input_data)

    # Invalid query shouldn't be sent to the reranking service, so `post` shouldn't be called."
    mock_post.assert_not_called()

    assert "Input should be greater than 0 [type=greater_than, input_value=-1, input_type=int]" in str(context.value)


# ---------------------------------------------------------------------------
# vLLM reranking path
# ---------------------------------------------------------------------------

def test_vllm_initialization_appends_score_suffix():
    with patch.object(EragReranker, '_validate', return_value=None):
        reranker = EragReranker(
            service_endpoint="http://bge-reranker-v2-m3-predictor.llm-inference.svc.cluster.local/v1",
            model_server="vllm",
            model_name="BAAI/bge-reranker-v2-m3",
            late_chunking_enabled=False,
        )
    assert reranker._service_endpoint.endswith("/score")
    assert reranker._model_name == "BAAI/bge-reranker-v2-m3"


def test_vllm_initialization_raises_when_model_name_missing():
    with pytest.raises(ValueError, match="RERANKING_MODEL_NAME"):
        EragReranker(
            service_endpoint="http://bge-reranker-v2-m3-predictor.llm-inference.svc.cluster.local/v1",
            model_server="vllm",
            late_chunking_enabled=False,
        )


@pytest.fixture
def vllm_reranker():
    with patch.object(EragReranker, '_validate', return_value=None):
        return EragReranker(
            service_endpoint="http://bge-reranker-v2-m3-predictor.llm-inference.svc.cluster.local/v1",
            model_server="vllm",
            model_name="BAAI/bge-reranker-v2-m3",
            late_chunking_enabled=False,
        )


@pytest.mark.asyncio
async def test_async_call_reranker_vllm_normalises_data_wrapper(vllm_reranker):
    """vLLM path of _async_call_reranker unwraps {"data": [...]} to [...]."""
    from unittest.mock import AsyncMock, MagicMock

    vllm_response = {"data": [{"index": 1, "score": 0.9}, {"index": 0, "score": 0.3}]}

    mock_response = AsyncMock()
    mock_response.json = AsyncMock(return_value=vllm_response)
    mock_response.raise_for_status = MagicMock(return_value=None)
    mock_response.__aenter__ = AsyncMock(return_value=mock_response)
    mock_response.__aexit__ = AsyncMock(return_value=False)

    mock_session = AsyncMock()
    mock_session.post = MagicMock(return_value=mock_response)
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=False)

    with patch("comps.reranks.utils.erag_reranking.aiohttp.ClientSession", return_value=mock_session):
        result = await vllm_reranker._async_call_reranker("What is DL?", ["DL is not...", "DL is..."])

    assert result == [{"index": 1, "score": 0.9}, {"index": 0, "score": 0.3}]
