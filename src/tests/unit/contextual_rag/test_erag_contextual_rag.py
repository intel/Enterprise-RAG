# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import socket
from unittest.mock import MagicMock, patch

import pytest
from requests.exceptions import RequestException

from comps.contextual_rag.utils.erag_contextual_rag import (
    DEFAULT_MAX_PROMPT_TOKENS,
    ContextLengthExceeded,
    EragContextualRag,
)
from comps.cores.proto.docarray import ContextualRagInput, TextDoc


"""
To execute these tests with coverage report, navigate to the `src` folder and run the following command:
   pytest --disable-warnings --cov=comps/contextual_rag --cov-report=term --cov-report=html tests/unit/contextual_rag/test_erag_contextual_rag.py

Alternatively, to run all tests for the 'contextual_rag' module, execute the following command:
   pytest --disable-warnings --cov=comps/contextual_rag --cov-report=term --cov-report=html tests/unit/contextual_rag
"""

ENDPOINT = "http://blurb-model:8000"
MODEL = "qwen3-4b-w8a8-blurb"


def _response(status_code=200, payload=None, text=""):
    """A stand-in for a requests.Response."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.text = text
    resp.json.return_value = payload if payload is not None else {}
    if status_code >= 400:
        resp.raise_for_status.side_effect = RequestException(f"HTTP {status_code}")
    return resp


def _chat_response(content):
    return _response(payload={"choices": [{"message": {"content": content}}]})


@pytest.fixture
def crag():
    """A service instance with a 1000-token budget, sticky routing off and no session.

    The served window is pre-set so nothing reaches out to /v1/models, and sticky routing
    is off so nothing reaches out to DNS -- both are exercised by their own tests below.
    """
    service = EragContextualRag(
        vllm_endpoint=ENDPOINT,
        context_model_name=MODEL,
        max_prompt_tokens=1000,
        sticky_routing=False,
    )
    service._served_window = 16384
    service._session = MagicMock()
    return service


@pytest.fixture
def input_docs():
    return ContextualRagInput(
        docs=[
            TextDoc(text="First chunk.", metadata={"chunk_id": 1}),
            TextDoc(text="Second chunk, the longest one in this document.", metadata={"chunk_id": 2}),
            TextDoc(text="Third chunk.", metadata={"chunk_id": 3}),
        ],
        whole_document="First chunk. Second chunk, the longest one in this document. Third chunk.",
        document_id="doc-42",
    )


# --------------------------------------------------------------------------- config

def test_endpoint_is_mandatory():
    # The LLM is deployed separately, so there is no address to fall back on.
    with pytest.raises(ValueError):
        EragContextualRag(vllm_endpoint="", context_model_name=MODEL)


def test_model_name_is_mandatory():
    with pytest.raises(ValueError):
        EragContextualRag(vllm_endpoint=ENDPOINT, context_model_name="")


def test_default_prompt_budget_is_16384_tokens():
    # The window the blurb model is served with, rather than "whatever the server serves".
    assert DEFAULT_MAX_PROMPT_TOKENS == 16384
    assert EragContextualRag(vllm_endpoint=ENDPOINT, context_model_name=MODEL)._max_prompt_tokens == 16384


def test_trailing_slash_is_stripped_from_the_endpoint():
    service = EragContextualRag(vllm_endpoint=f"{ENDPOINT}/", context_model_name=MODEL)
    assert service._base_url == ENDPOINT


def test_env_proxies_are_ignored_by_default():
    # Sticky routing dials pod IPs, which the container's no_proxy (Service names) does
    # not cover, so an inherited http_proxy would hijack in-cluster requests.
    assert EragContextualRag(vllm_endpoint=ENDPOINT, context_model_name=MODEL)._session.trust_env is False
    assert EragContextualRag(
        vllm_endpoint=ENDPOINT, context_model_name=MODEL, trust_env_proxy=True
    )._session.trust_env is True


# -------------------------------------------------------------------------- routing

def test_replica_host_defaults_to_the_headless_service():
    service = EragContextualRag(vllm_endpoint=ENDPOINT, context_model_name=MODEL)
    assert service._replica_host == "blurb-model-headless"
    assert service._port == 8000


def test_replica_urls_are_derived_from_dns():
    service = EragContextualRag(vllm_endpoint=ENDPOINT, context_model_name=MODEL)
    infos = [(None, None, None, None, ("10.0.0.2", 8000)), (None, None, None, None, ("10.0.0.1", 8000))]
    with patch("socket.getaddrinfo", return_value=infos) as mock_dns:
        assert service._replica_urls() == ["http://10.0.0.1:8000", "http://10.0.0.2:8000"]
        # Cached for replica_ttl seconds, so one lookup per TTL and not one per document.
        service._replica_urls()
        assert mock_dns.call_count == 1


def test_replica_urls_fall_back_to_the_configured_url_when_dns_fails():
    # A ClusterIP Service or the AI gateway in front: no headless name to resolve.
    service = EragContextualRag(vllm_endpoint=ENDPOINT, context_model_name=MODEL)
    with patch("socket.getaddrinfo", side_effect=socket.gaierror("no such host")):
        assert service._replica_urls() == [ENDPOINT]


def test_document_sticky_routing_is_deterministic():
    service = EragContextualRag(vllm_endpoint=ENDPOINT, context_model_name=MODEL)
    replicas = [f"http://10.0.0.{i}:8000" for i in range(1, 4)]
    with patch.object(EragContextualRag, "_replica_urls", return_value=replicas):
        # Same document -> same replica, so the prefix cache it warmed is reused.
        assert service._base_for("doc-a") == service._base_for("doc-a")
        assert service._base_for("doc-a") in replicas
        # Different documents spread over the replicas, which is where parallelism comes
        # from once every chunk of a document is pinned.
        assert len({service._base_for(f"doc-{i}") for i in range(50)}) == len(replicas)


def test_sticky_routing_can_be_turned_off(crag):
    with patch.object(EragContextualRag, "_replica_urls") as mock_replicas:
        assert crag._base_for("doc-a") == ENDPOINT
        mock_replicas.assert_not_called()


# --------------------------------------------------------- budget and served window

def _uncached(max_prompt_tokens):
    service = EragContextualRag(vllm_endpoint=ENDPOINT, context_model_name=MODEL,
                                max_prompt_tokens=max_prompt_tokens)
    service._session = MagicMock()
    return service


def test_served_window_is_read_from_the_model_card():
    service = _uncached(16384)
    service._session.get.return_value = _response(payload={"data": [
        {"id": "other-model", "max_model_len": 4096},
        {"id": MODEL, "max_model_len": 16384},
    ]})

    assert service._served_context_window(ENDPOINT, MODEL) == 16384
    # Read once: it is a property of the running server, not of a request.
    service._served_context_window(ENDPOINT, MODEL)
    assert service._session.get.call_count == 1


def test_served_window_uses_the_first_card_that_advertises_a_window():
    # A single-model server reports the served name, which may differ from the HF repo id.
    service = _uncached(16384)
    service._session.get.return_value = _response(
        payload={"data": [{"id": "RedHatAI/Qwen3-4B-Instruct-2507-quantized.w8a8", "max_model_len": 16384}]})
    assert service._served_context_window(ENDPOINT, MODEL) == 16384


def test_served_window_is_unknown_when_the_card_is_unreadable():
    service = _uncached(16384)
    service._session.get.side_effect = RequestException("connection refused")
    assert service._served_context_window(ENDPOINT, MODEL) == 0
    # The configured budget still applies; the server's own 400 is the backstop.
    assert service._prompt_budget(ENDPOINT, MODEL) == 16384


def test_prompt_budget_is_capped_at_the_served_window():
    # The server rejects any request that does not fit its window, so a larger budget
    # would only turn into failed requests.
    service = _uncached(16384)
    service._served_window = 8192
    assert service._prompt_budget(ENDPOINT, MODEL) == 8192


def test_prompt_budget_below_the_served_window_is_kept(crag):
    assert crag._prompt_budget(ENDPOINT, MODEL) == 1000


def test_prompt_budget_zero_means_the_whole_served_window():
    service = _uncached(0)
    service._served_window = 16384
    assert service._prompt_budget(ENDPOINT, MODEL) == 16384


def test_prompt_budget_falls_back_to_the_default_when_nothing_is_known():
    service = _uncached(0)
    service._served_window = 0
    assert service._prompt_budget(ENDPOINT, MODEL) == DEFAULT_MAX_PROMPT_TOKENS


# ------------------------------------------------------------ prompt measurement

SYSTEM = {"role": "system", "content": "<document>\ndocument\n</document>"}


def test_prompt_length_is_measured_with_tokenize(crag):
    crag._session.post.return_value = _response(payload={"count": 321})
    assert crag._prompt_tokens(ENDPOINT, MODEL, SYSTEM, "chunk") == 321
    assert crag._session.post.call_args[0][0] == f"{ENDPOINT}/tokenize"
    sent = crag._session.post.call_args.kwargs["json"]
    # Counted exactly as the generation request is built: same messages, same template.
    assert sent["messages"][0] == SYSTEM
    assert sent["messages"][1]["role"] == "user"
    assert sent["add_generation_prompt"] is True


def test_prompt_length_falls_back_to_an_estimate_when_tokenize_is_not_served(crag):
    # /tokenize is a vLLM extension, so a gateway may not route it.
    crag._session.post.return_value = _response(status_code=404, text="Not Found")
    estimate = crag._prompt_tokens(ENDPOINT, MODEL, {"role": "system", "content": "a" * 350}, "chunk")
    assert estimate > 100          # 355 chars at 3.5 chars per token
    assert crag._tokenize_supported is False

    # Latched off: every future document would otherwise pay the same failing round trip.
    crag._session.post.reset_mock()
    crag._prompt_tokens(ENDPOINT, MODEL, SYSTEM, "chunk")
    crag._session.post.assert_not_called()


def test_a_transient_tokenize_failure_does_not_switch_tokenize_off(crag):
    crag._session.post.side_effect = RequestException("connection reset")
    assert crag._prompt_tokens(ENDPOINT, MODEL, SYSTEM, "chunk") > 0
    assert crag._tokenize_supported is True


def test_a_prompt_too_long_to_count_raises_context_length_exceeded(crag):
    crag._session.post.return_value = _response(
        status_code=400, text="This model's maximum context length is 16384 tokens")
    with pytest.raises(ContextLengthExceeded):
        crag._count_tokens(ENDPOINT, MODEL, [SYSTEM])
    assert crag._tokenize_supported is True


# --------------------------------------------------------------- fit or skip

CHUNKS = ["a much longer chunk than the others", "short", "mid chunk"]


def test_a_document_fits_when_every_prompt_plus_the_blurb_fits_the_budget(crag):
    # 900 + 100 == 1000: exactly at the budget still fits.
    with patch.object(crag, "_prompt_tokens", return_value=900):
        fits, tokens, budget = crag._document_fits(ENDPOINT, MODEL, SYSTEM, CHUNKS, 100)
    assert (fits, tokens, budget) == (True, 900, 1000)


def test_one_token_over_the_budget_does_not_fit(crag):
    with patch.object(crag, "_prompt_tokens", return_value=901):
        fits, tokens, _ = crag._document_fits(ENDPOINT, MODEL, SYSTEM, CHUNKS, 100)
    assert fits is False and tokens == 901


def test_a_document_whose_longest_chunk_does_not_fit_is_rejected_after_one_count(crag):
    # The common case for a large document: one /tokenize call, and no per-chunk work.
    with patch.object(crag, "_prompt_tokens", return_value=5000) as measure:
        fits, _, _ = crag._document_fits(ENDPOINT, MODEL, SYSTEM, CHUNKS, 100)
    assert fits is False
    assert measure.call_count == 1
    assert measure.call_args[0][3] == CHUNKS[0]   # the longest chunk is measured first


def test_every_chunk_is_checked_not_just_the_longest(crag):
    # A chunk with fewer characters can still tokenize longer (non-ASCII text, digits),
    # and the budget is per request: one chunk over it keeps the whole document out.
    tokens = {CHUNKS[0]: 850, CHUNKS[1]: 950, CHUNKS[2]: 800}
    with patch.object(crag, "_prompt_tokens", side_effect=lambda b, m, s, chunk: tokens[chunk]) as measure:
        fits, worst, _ = crag._document_fits(ENDPOINT, MODEL, SYSTEM, CHUNKS, 100)
    assert fits is False and worst == 950
    assert measure.call_count == len(CHUNKS)


def test_with_an_estimate_only_the_longest_chunk_is_measured(crag):
    # The estimate is proportional to characters, so the longest chunk is the worst case.
    crag._tokenize_supported = False
    with patch.object(crag, "_prompt_tokens", return_value=500) as measure:
        fits, _, _ = crag._document_fits(ENDPOINT, MODEL, SYSTEM, CHUNKS, 100)
    assert fits is True
    assert measure.call_count == 1


def test_a_document_the_server_refuses_to_count_does_not_fit(crag):
    with patch.object(crag, "_prompt_tokens", side_effect=ContextLengthExceeded("maximum context length")):
        fits, tokens, _ = crag._document_fits(ENDPOINT, MODEL, SYSTEM, CHUNKS, 100)
    assert fits is False and tokens is None


def test_a_shorter_chunk_the_server_refuses_to_count_keeps_the_document_out(crag):
    def measure(base_url, model, system_message, chunk):
        if chunk == CHUNKS[0]:
            return 500
        raise ContextLengthExceeded("maximum context length")
    with patch.object(crag, "_prompt_tokens", side_effect=measure):
        fits, tokens, _ = crag._document_fits(ENDPOINT, MODEL, SYSTEM, CHUNKS, 100)
    assert fits is False and tokens is None


def test_a_generation_budget_that_leaves_no_room_for_a_prompt_is_a_configuration_error(crag):
    with pytest.raises(ValueError):
        crag._document_fits(ENDPOINT, MODEL, SYSTEM, CHUNKS, max_new_tokens=1000)


# ----------------------------------------------------------------- blurb request

def test_blurb_returns_the_generated_context(crag):
    crag._session.post.return_value = _chat_response("  This chunk covers Q2 revenue.  ")
    blurb = crag._blurb(f"{ENDPOINT}/v1/chat/completions", {"role": "system", "content": "doc"},
                        "chunk", MODEL, 100)
    assert blurb == "This chunk covers Q2 revenue."

    payload = crag._session.post.call_args.kwargs["json"]
    # Document first, chunk last: that ordering is what makes the document a reusable
    # prefix for vLLM's automatic prefix caching.
    assert payload["messages"][0]["role"] == "system"
    assert payload["messages"][1]["role"] == "user"
    assert payload["temperature"] == 0.0
    assert payload["max_tokens"] == 100


def test_blurb_retries_a_failed_request_then_raises(crag):
    crag._session.post.side_effect = RequestException("connection reset")
    with patch("time.sleep"):
        with pytest.raises(ValueError):
            crag._blurb(f"{ENDPOINT}/v1/chat/completions", {"role": "system", "content": "doc"},
                        "chunk", MODEL, 100)
    assert crag._session.post.call_count == crag._max_retries + 1


def test_blurb_surfaces_a_context_length_rejection_without_retrying(crag):
    crag._session.post.return_value = _response(
        status_code=400, text="This model's maximum context length is 4096 tokens")
    with pytest.raises(ContextLengthExceeded):
        crag._blurb(f"{ENDPOINT}/v1/chat/completions", {"role": "system", "content": "doc"},
                    "chunk", MODEL, 100)
    # Retrying the same over-long prompt would fail identically; the caller skips instead.
    assert crag._session.post.call_count == 1


# ---------------------------------------------------------------------- run()

FITS = (True, 500, 1000)


def test_run_prepends_the_blurb_to_every_chunk(crag, input_docs):
    with patch.object(crag, "_document_fits", return_value=FITS), \
         patch.object(crag, "_blurb", side_effect=lambda *a, **kw: "CONTEXT"):
        result = crag.run(input_docs)

    assert len(result.docs) == 3
    for original, doc in zip(input_docs.docs, result.docs):
        # The blurb becomes part of the indexed text; the chunk is preserved verbatim.
        assert doc.text == f"CONTEXT\n\n{original.text}"
        assert doc.metadata["context_blurb"] == "CONTEXT"
        assert doc.metadata["chunk_id"] == original.metadata["chunk_id"]


def test_run_always_sends_the_whole_document(crag, input_docs):
    sent = []
    with patch.object(crag, "_document_fits", return_value=FITS), \
         patch.object(crag, "_blurb", side_effect=lambda url, sysmsg, *a: sent.append(sysmsg["content"]) or "CTX"):
        crag.run(input_docs)
    # Never truncated: every blurb request carries the source document verbatim.
    assert set(sent) == {f"<document>\n{input_docs.whole_document}\n</document>"}


def test_run_checks_the_fit_with_the_whole_document_and_every_chunk(crag, input_docs):
    with patch.object(crag, "_document_fits", return_value=FITS) as mock_fit, \
         patch.object(crag, "_blurb", return_value="CTX"):
        crag.run(input_docs)
    system_message, chunks, max_new_tokens = mock_fit.call_args[0][2:]
    assert input_docs.whole_document in system_message["content"]
    assert chunks == [doc.text for doc in input_docs.docs]
    assert max_new_tokens == 100


def test_run_skips_a_document_that_does_not_fit(crag, input_docs):
    with patch.object(crag, "_document_fits", return_value=(False, 5000, 1000)), \
         patch.object(crag, "_blurb") as mock_blurb:
        result = crag.run(input_docs)
    # No LLM call, and the chunks come back exactly as they went in: indexed as they
    # would be without contextual RAG, rather than against a truncated document.
    mock_blurb.assert_not_called()
    assert [doc.text for doc in result.docs] == [doc.text for doc in input_docs.docs]
    assert [doc.metadata for doc in result.docs] == [doc.metadata for doc in input_docs.docs]


def test_run_skips_the_document_when_the_server_rejects_a_prompt(crag, input_docs):
    sent = []

    def blurb(url, system_message, chunk, *args):
        sent.append(system_message["content"])
        raise ContextLengthExceeded("maximum context length")

    with patch.object(crag, "_document_fits", return_value=FITS), \
         patch.object(crag, "_blurb", side_effect=blurb):
        result = crag.run(input_docs)

    # Not retried on a shortened document: skipped whole, chunks unchanged.
    assert len(sent) == 1
    assert [doc.text for doc in result.docs] == [doc.text for doc in input_docs.docs]
    assert all("context_blurb" not in doc.metadata for doc in result.docs)


def test_run_keeps_the_chunk_unchanged_when_the_model_returns_nothing(crag, input_docs):
    with patch.object(crag, "_document_fits", return_value=FITS), \
         patch.object(crag, "_blurb", return_value=""):
        result = crag.run(input_docs)
    assert [doc.text for doc in result.docs] == [doc.text for doc in input_docs.docs]


def test_run_warms_the_prefix_cache_with_the_first_chunk(crag, input_docs):
    calls = []
    with patch.object(crag, "_document_fits", return_value=FITS), \
         patch.object(crag, "_blurb", side_effect=lambda url, sysmsg, chunk, *a: calls.append(chunk) or "CTX"):
        crag.run(input_docs)

    # The first chunk is sent alone so the document's KV cache is resident before the
    # rest are fanned out; otherwise every chunk would miss and re-prefill the document.
    assert calls[0] == input_docs.docs[0].text
    assert set(calls) == {doc.text for doc in input_docs.docs}


def test_run_returns_nothing_for_an_empty_request(crag):
    result = crag.run(ContextualRagInput(docs=[], whole_document="doc"))
    assert result.docs == []


def test_run_approximates_a_missing_source_document_from_the_chunks(crag, input_docs):
    request = ContextualRagInput(docs=input_docs.docs, whole_document="   ")
    with patch.object(crag, "_document_fits", return_value=FITS) as mock_fit, \
         patch.object(crag, "_blurb", return_value="CTX"):
        result = crag.run(request)
    assert len(result.docs) == 3
    joined = "\n".join(doc.text for doc in input_docs.docs)
    assert mock_fit.call_args[0][2]["content"] == f"<document>\n{joined}\n</document>"


def test_run_uses_the_per_request_model_and_generation_budget(crag, input_docs):
    request = ContextualRagInput(
        docs=input_docs.docs, whole_document=input_docs.whole_document,
        context_model_name="another-model", max_new_tokens=42,
    )
    with patch.object(crag, "_document_fits", return_value=FITS) as mock_fit, \
         patch.object(crag, "_blurb", return_value="CTX") as mock_blurb:
        crag.run(request)
    assert mock_fit.call_args[0][1] == "another-model"
    assert mock_fit.call_args[0][4] == 42
    assert mock_blurb.call_args[0][3] == "another-model"
    assert mock_blurb.call_args[0][4] == 42


def test_run_reports_a_transport_failure_as_a_value_error(crag, input_docs):
    with patch.object(crag, "_document_fits", return_value=FITS), \
         patch.object(crag, "_blurb", side_effect=RequestException("connection refused")):
        with pytest.raises(ValueError):
            crag.run(input_docs)


def test_run_end_to_end_against_a_fake_server(crag, input_docs):
    """No method patched: /tokenize says it fits, chat completions return blurbs."""
    def post(url, json=None, timeout=None):
        if url.endswith("/tokenize"):
            return _response(payload={"count": 120})
        return _chat_response(f"About {json['messages'][1]['content'].split(chr(10))[2]}")
    crag._session.post.side_effect = post
    result = crag.run(input_docs)
    for original, doc in zip(input_docs.docs, result.docs):
        assert doc.text == f"About {original.text}\n\n{original.text}"
    # One count per chunk (all fit, so every chunk is checked) + one blurb per chunk.
    urls = [c[0][0] for c in crag._session.post.call_args_list]
    assert urls.count(f"{ENDPOINT}/tokenize") == 3
    assert urls.count(f"{ENDPOINT}/v1/chat/completions") == 3


def test_run_end_to_end_skips_an_oversized_document_with_one_count(crag, input_docs):
    crag._session.post.return_value = _response(payload={"count": 20000})
    result = crag.run(input_docs)
    assert [doc.text for doc in result.docs] == [doc.text for doc in input_docs.docs]
    assert crag._session.post.call_count == 1      # one /tokenize, no blurb requests
