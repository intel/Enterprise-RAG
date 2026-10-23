# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import hashlib
import math
import socket
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit

import requests
from requests.adapters import HTTPAdapter
from requests.exceptions import RequestException

from comps.cores.mega.logger import get_erag_logger
from comps.cores.proto.docarray import ContextualRagInput, TextDoc, TextDocList
from comps.contextual_rag.utils.prompt import CONTEXT_HUMAN_TEMPLATE, CONTEXT_SYSTEM_TEMPLATE


logger = get_erag_logger(f"{__file__.split('comps/')[1].split('/', 1)[0]}_microservice")

# Default token budget for one blurb request (prompt + generated blurb). Matches the
# 16384-token window the dedicated blurb model (qwen3-4b-w8a8-blurb) is served with.
# With max_new_tokens=100 it holds 606 of the 607 MultiHop-RAG corpus documents whole
# (98.9% of their chunks), against 98.0% of the documents and 89.7% of the chunks at 8192.
DEFAULT_MAX_PROMPT_TOKENS = 16384

# vLLM rejects an over-long prompt with HTTP 400 and one of these in the body.
CONTEXT_LENGTH_MARKERS = (
    "maximum context length",
    "longer than the maximum",
    "context_length_exceeded",
    "please reduce the length",
)


class ContextLengthExceeded(RuntimeError):
    """The server refused the prompt because it does not fit its context window."""


class EragContextualRag:
    """Anthropic-style Contextual Retrieval, applied only where it fits whole.

    For each chunk an LLM writes a short blurb situating that chunk within its parent
    document; the blurb is prepended to the chunk text before the chunk is embedded and
    indexed. See https://www.anthropic.com/engineering/contextual-retrieval.

    One request carries the chunks of exactly ONE source document plus that document's
    full text (``whole_document``). Chunks are never contextualised against a corpus or
    against a concatenation of several documents -- doing so produces blurbs that
    situate a chunk in the wrong document and actively hurts retrieval.

    Documents are never truncated. A document is contextualised only when, for every one
    of its chunks, the blurb prompt (the whole document + the whole chunk + the chat
    template) plus the blurb the model may write (``max_new_tokens``) fits the token
    budget: CONTEXT_MAX_PROMPT_TOKENS, capped at the window the LLM is actually served
    with. Prompt length is measured exactly with vLLM's ``/tokenize``. A document that
    does not fit is skipped as a whole and its chunks are returned unchanged, so they are
    indexed exactly as they would be without contextual RAG. A blurb computed against a
    cut-down document would situate the chunk in text that does not contain it.

    Three things make this fast enough to run at ingest time:

    * **Prompt caching.** The document sits in a shared prompt prefix, identical for
      every chunk, so vLLM's automatic prefix caching computes its KV cache once and
      reuses it. This is the blog post's prompt-caching optimisation. The model must be
      served with ``--enable-prefix-caching``; the ``llm`` category in
      ``deployment/models.yaml`` already passes it.
    * **Prefix warm-up.** The prefix cache only helps requests that arrive *after* the
      prefix is resident. Firing every chunk at once would make them all miss and each
      re-prefill the whole document, so the first chunk is sent alone to populate the
      cache and the rest are fanned out behind it.
    * **Document-sticky routing.** vLLM's prefix cache is per replica, so round-robin
      load balancing across N replicas cuts the hit rate to ~1/N. Every chunk of a
      document is pinned to one replica; parallelism across replicas comes from
      different documents being ingested concurrently. This needs pod-level addresses
      (CONTEXT_VLLM_REPLICA_HOST); behind a Service or the AI gateway it degrades to a
      single URL and the gateway's own scheduling decides placement.
    """

    def __init__(
        self,
        vllm_endpoint: str = "",
        context_model_name: str = "",
        max_new_tokens: int = 100,
        max_concurrency: int = 32,
        max_prompt_tokens: int = DEFAULT_MAX_PROMPT_TOKENS,
        chars_per_token: float = 3.5,
        request_timeout: int = 300,
        max_retries: int = 2,
        sticky_routing: bool = True,
        replica_host: str = "",
        replica_ttl: int = 60,
        trust_env_proxy: bool = False,
    ):
        # No default endpoint: the LLM is deployed independently of this microservice
        # (model-manager / KServe, or any OpenAI-compatible server), so there is no
        # address that could be guessed correctly. A missing endpoint fails here rather
        # than silently contextualising nothing.
        if not vllm_endpoint:
            raise ValueError("VLLM_SERVER_ENDPOINT must be set for contextual RAG.")
        if not context_model_name:
            raise ValueError("CONTEXT_MODEL_NAME must be set for contextual RAG.")

        self._base_url = vllm_endpoint.rstrip("/")
        self._model = context_model_name
        self._max_new_tokens = max_new_tokens
        self._max_concurrency = max(1, max_concurrency)
        self._timeout = request_timeout
        self._max_retries = max(0, max_retries)

        # Token budget for one blurb request, prompt + blurb. 0 means "the whole served
        # window"; any other value is additionally capped at the served window, because
        # the server rejects a request that does not fit it.
        self._max_prompt_tokens = max(0, int(max_prompt_tokens))
        self._served_window = None  # read lazily from the model card, then cached
        self._window_lock = threading.Lock()
        # Only used when /tokenize is unreachable. Deliberately below the ~4.0 English
        # average so the estimate errs towards over-counting, i.e. towards skipping a
        # document rather than sending one that does not fit.
        self._chars_per_token = chars_per_token if chars_per_token > 0 else 3.5
        self._tokenize_supported = True

        # Sticky routing needs individual replica addresses, which a ClusterIP Service
        # hides behind a single virtual IP. A headless Service resolves to the pod IPs
        # instead; default to the "<service>-headless" convention.
        parsed = urlsplit(self._base_url)
        self._scheme = parsed.scheme or "http"
        self._port = parsed.port or (443 if self._scheme == "https" else 80)
        self._sticky = sticky_routing
        self._replica_host = replica_host or f"{parsed.hostname}-headless"
        self._replica_ttl = replica_ttl
        self._replicas: list = []
        self._replicas_expire_at = 0.0
        self._replica_lock = threading.Lock()

        # requests' default connection pool holds 10 sockets, which would silently
        # serialise anything above that no matter how large max_concurrency is.
        self._session = requests.Session()
        # Sticky routing dials pod IPs, and the container's no_proxy lists Service names
        # only -- so an inherited http_proxy would hijack those requests and send them
        # to the corporate proxy. The LLM is in-cluster, so ignore env proxies unless a
        # deployment explicitly points this at an external endpoint.
        self._session.trust_env = trust_env_proxy
        adapter = HTTPAdapter(
            pool_connections=self._max_concurrency,
            pool_maxsize=self._max_concurrency,
            max_retries=0,  # retries are handled per request, below
        )
        self._session.mount("http://", adapter)
        self._session.mount("https://", adapter)

    # ---------------------------------------------------------------- routing

    def _replica_urls(self) -> list:
        """Pod-level base URLs of the LLM replicas, refreshed on a TTL.

        Falls back to the configured URL when the headless name does not resolve (single
        replica, a ClusterIP Service or gateway in front, or sticky routing turned off),
        so a DNS change can never take contextualisation down.
        """
        now = time.monotonic()
        if self._replicas and now < self._replicas_expire_at:
            return self._replicas

        with self._replica_lock:
            if self._replicas and time.monotonic() < self._replicas_expire_at:
                return self._replicas
            urls = []
            try:
                infos = socket.getaddrinfo(self._replica_host, self._port, proto=socket.IPPROTO_TCP)
                # Sorted so every contextual-rag replica derives the same document to
                # replica mapping from the same DNS answer.
                for ip in sorted({info[4][0] for info in infos}):
                    urls.append(f"{self._scheme}://{ip}:{self._port}")
            except socket.gaierror as e:
                logger.debug(f"Headless lookup of {self._replica_host} failed ({e}); using the configured URL.")
            if not urls:
                urls = [self._base_url]
            if urls != self._replicas:
                logger.info(f"Contextual RAG LLM replicas: {len(urls)} ({', '.join(urls)})")
            self._replicas = urls
            self._replicas_expire_at = time.monotonic() + self._replica_ttl
            return self._replicas

    def _base_for(self, document_id: str) -> str:
        """Pick the replica that owns this document, so its cached prefix is reused."""
        if not self._sticky:
            return self._base_url
        replicas = self._replica_urls()
        if len(replicas) == 1:
            return replicas[0]
        digest = hashlib.blake2b(document_id.encode("utf-8"), digest_size=8).digest()
        return replicas[int.from_bytes(digest, "big") % len(replicas)]

    # ------------------------------------------------------ context accounting

    def _served_context_window(self, base_url: str, model: str) -> int:
        """Tokens the LLM is actually served with (its max_model_len), or 0 if unknown.

        Read once from the vLLM model card and cached: it is a property of the running
        server, not of a request.
        """
        if self._served_window is not None:
            return self._served_window
        with self._window_lock:
            if self._served_window is not None:
                return self._served_window
            window = 0
            try:
                resp = self._session.get(f"{base_url}/v1/models", timeout=min(self._timeout, 30))
                resp.raise_for_status()
                cards = resp.json().get("data", [])
                # Prefer the card for the model actually being asked for; fall back to
                # the first card that advertises a window (single-model servers report
                # the served name, which may differ from the HF repo id).
                for card in cards:
                    if card.get("id") == model and card.get("max_model_len"):
                        window = int(card["max_model_len"])
                        break
                else:
                    for card in cards:
                        if card.get("max_model_len"):
                            window = int(card["max_model_len"])
                            break
            except (RequestException, ValueError, KeyError, TypeError) as e:
                logger.warning(f"Could not read the context window from {base_url}/v1/models ({e}).")
            if window:
                logger.info(f"LLM {model} is served with a {window}-token context window.")
            self._served_window = window
            return self._served_window

    def _prompt_budget(self, base_url: str, model: str) -> int:
        """Tokens one blurb request (prompt + blurb) may use.

        CONTEXT_MAX_PROMPT_TOKENS, but never more than the served window: the server
        rejects a request that does not fit it, so a larger budget would only turn into
        failed requests. 0 means the whole served window.
        """
        served = self._served_context_window(base_url, model)
        if self._max_prompt_tokens and served:
            if self._max_prompt_tokens > served:
                logger.warning(
                    f"CONTEXT_MAX_PROMPT_TOKENS={self._max_prompt_tokens} exceeds the "
                    f"{served}-token window {model} is served with; using {served}.")
            return min(self._max_prompt_tokens, served)
        return self._max_prompt_tokens or served or DEFAULT_MAX_PROMPT_TOKENS

    @staticmethod
    def _system_message(whole_document: str) -> dict:
        # Formatted once per document, not once per chunk: for a large document the
        # string copy is the expensive part, and it must stay byte-identical anyway for
        # the prefix cache to hit.
        return {"role": "system", "content": CONTEXT_SYSTEM_TEMPLATE.format(whole_document=whole_document)}

    @staticmethod
    def _user_message(chunk: str) -> dict:
        return {"role": "user", "content": CONTEXT_HUMAN_TEMPLATE.format(chunk_content=chunk)}

    def _count_tokens(self, base_url: str, model: str, messages: list):
        """Exact prompt length from vLLM's /tokenize, or None when it is unavailable.

        Counting server-side avoids shipping a tokenizer (and the model's weights) into
        this microservice just to decide whether a document fits. /tokenize is a vLLM
        extension, not part of the OpenAI API, so a gateway or a non-vLLM server may not
        route it -- hence the estimate fallback rather than a hard failure.

        Raises ContextLengthExceeded if the server refuses even to count the prompt
        because it is longer than the served window: that document cannot fit.
        """
        if not self._tokenize_supported:
            return None
        try:
            resp = self._session.post(
                f"{base_url}/tokenize",
                json={"model": model, "messages": messages, "add_generation_prompt": True},
                timeout=min(self._timeout, 60),
            )
            if resp.status_code == 400 and any(
                    marker in resp.text.lower() for marker in CONTEXT_LENGTH_MARKERS):
                raise ContextLengthExceeded(resp.text[:400])
            if resp.status_code in (404, 405, 501):
                # The endpoint is missing, not failing: latch it off, since every future
                # call would pay the same round trip to fail the same way.
                self._tokenize_supported = False
                logger.warning(
                    f"/tokenize is not served by {base_url} (HTTP {resp.status_code}); "
                    f"falling back to a {self._chars_per_token} chars-per-token estimate "
                    f"of the prompt length.")
                return None
            resp.raise_for_status()
            return int(resp.json()["count"])
        except (RequestException, ValueError, KeyError, TypeError) as e:
            logger.warning(
                f"/tokenize failed on {base_url} ({e}); estimating this prompt at "
                f"{self._chars_per_token} chars per token.")
            return None

    def _prompt_tokens(self, base_url: str, model: str, system_message: dict, chunk: str) -> int:
        messages = [system_message, self._user_message(chunk)]
        exact = self._count_tokens(base_url, model, messages)
        if exact is not None:
            return exact
        chars = sum(len(m["content"]) for m in messages)
        return int(math.ceil(chars / self._chars_per_token))

    def _document_fits(self, base_url: str, model: str, system_message: dict,
                       chunks: list, max_new_tokens: int):
        """Whether every chunk's blurb request fits the budget with the WHOLE document.

        Returns (fits, prompt_tokens, budget), where prompt_tokens is the largest prompt
        measured. Nothing is ever cut: the caller either sends the document whole or does
        not contextualise it at all.

        The longest chunk is measured first. If its prompt does not fit, the document is
        rejected after a single /tokenize call -- the common case for a large document.
        If it fits, every other chunk is measured too, because a chunk with fewer
        characters can still tokenize longer (non-ASCII text, digits, symbols), and the
        budget is enforced per request, not on average.
        """
        budget = self._prompt_budget(base_url, model)
        limit = budget - max_new_tokens
        if limit <= 0:
            raise ValueError(
                f"max_new_tokens={max_new_tokens} leaves no room for a prompt in the "
                f"{budget}-token budget of {model}; raise CONTEXT_MAX_PROMPT_TOKENS or "
                f"lower MAX_NEW_TOKENS.")

        order = sorted(range(len(chunks)), key=lambda i: len(chunks[i]), reverse=True)
        try:
            longest = self._prompt_tokens(base_url, model, system_message, chunks[order[0]])
        except ContextLengthExceeded:
            return False, None, budget
        if longest > limit or len(order) == 1:
            return longest <= limit, longest, budget
        if not self._tokenize_supported:
            # The estimate is proportional to characters, so the longest chunk is the
            # worst case and nothing more is learned by estimating the rest.
            return True, longest, budget

        def measure(i):
            try:
                return self._prompt_tokens(base_url, model, system_message, chunks[i])
            except ContextLengthExceeded:
                return math.inf
        with ThreadPoolExecutor(max_workers=min(self._max_concurrency, len(order) - 1)) as pool:
            worst = max([longest, *pool.map(measure, order[1:])])
        if worst == math.inf:
            return False, None, budget
        return worst <= limit, worst, budget

    # ------------------------------------------------------------- generation

    def _blurb(self, url: str, system_message: dict, chunk: str, model: str, max_new_tokens: int) -> str:
        payload = {
            "model": model,
            "messages": [
                # Document first and byte-identical across the document's chunks: this
                # is the cached prefix. The chunk-specific part must stay last.
                system_message,
                self._user_message(chunk),
            ],
            "max_tokens": max_new_tokens,
            "temperature": 0.0,
        }
        last_error = None
        for attempt in range(self._max_retries + 1):
            try:
                resp = self._session.post(url, json=payload, timeout=self._timeout)
                # Retrying an over-long prompt unchanged would fail identically every
                # time; surface it so the caller can skip the document instead.
                if resp.status_code == 400 and any(
                        marker in resp.text.lower() for marker in CONTEXT_LENGTH_MARKERS):
                    raise ContextLengthExceeded(resp.text[:400])
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"].strip()
            except RequestException as e:
                last_error = e
                if attempt < self._max_retries:
                    time.sleep(2 ** attempt)
        raise ValueError(f"Contextual RAG LLM request failed after {self._max_retries + 1} attempt(s): {last_error}")

    def run(self, input: ContextualRagInput) -> TextDocList:
        if not input.docs:
            return TextDocList(docs=[])

        # Per-request overrides fall back to service defaults.
        model = input.context_model_name or self._model
        max_new_tokens = input.max_new_tokens or self._max_new_tokens
        chunks = list(input.docs)

        whole_document = input.whole_document
        if not whole_document or not whole_document.strip():
            # Degraded fallback for callers that cannot supply the source text. The
            # chunks are still all from one document, so this is an approximation of
            # that document rather than a mix of several.
            whole_document = "\n".join(d.text for d in chunks)
            logger.warning(
                "Request carried no whole_document; approximating it from the chunks. "
                "Blurb quality is reduced -- have the caller send the source text.")

        document_id = input.document_id or hashlib.blake2b(
            whole_document.encode("utf-8"), digest_size=8).hexdigest()
        base_url = self._base_for(document_id)
        url = f"{base_url}/v1/chat/completions"
        system_message = self._system_message(whole_document)

        fits, prompt_tokens, budget = self._document_fits(
            base_url, model, system_message, [c.text for c in chunks], max_new_tokens)
        if not fits:
            need = (f"needs {prompt_tokens} + {max_new_tokens} tokens" if prompt_tokens is not None
                    else "is longer than the served context window")
            logger.info(
                f"Contextual RAG skipped for document {document_id}: its blurb prompt "
                f"{need}, over the {budget}-token budget (CONTEXT_MAX_PROMPT_TOKENS). "
                f"Its {len(chunks)} chunk(s) are indexed without blurbs; the document is "
                f"not truncated.")
            return TextDocList(docs=chunks)

        started = time.time()
        try:
            # Warm the prefix cache with one chunk, then fan the rest out behind it.
            blurbs = [self._blurb(url, system_message, chunks[0].text, model, max_new_tokens)]
            if len(chunks) > 1:
                with ThreadPoolExecutor(max_workers=min(self._max_concurrency, len(chunks) - 1)) as pool:
                    blurbs.extend(pool.map(
                        lambda c: self._blurb(url, system_message, c.text, model, max_new_tokens),
                        chunks[1:]))
        except ContextLengthExceeded as e:
            # The fit check said yes but the server says no -- a window that shrank on
            # restart, or a prompt that could only be estimated. Never retry on a cut-down
            # document: skip it whole, exactly as if it had not fitted in the first place.
            logger.warning(
                f"Contextual RAG skipped for document {document_id}: the server rejected "
                f"a blurb prompt as too long for its context window, so its {len(chunks)} "
                f"chunk(s) are indexed without blurbs. Check that CONTEXT_MAX_PROMPT_TOKENS "
                f"does not exceed the served max_model_len. Server said: {e}")
            return TextDocList(docs=chunks)
        except RequestException as e:
            raise ValueError(f"Contextual RAG LLM request failed: {e}")

        out = []
        for doc, blurb in zip(chunks, blurbs):
            # Prepend, exactly as the blog post does: the blurb becomes part of the text
            # that gets embedded and indexed, and the original chunk text is preserved
            # verbatim after it.
            out.append(TextDoc(
                text=f"{blurb}\n\n{doc.text}" if blurb else doc.text,
                metadata={**(doc.metadata or {}), "context_blurb": blurb},
            ))

        logger.info(
            f"Contextualized {len(out)} chunk(s) of document {document_id} in "
            f"{round(time.time() - started, 1)}s via {base_url} (whole document in prompt, "
            f"largest prompt {prompt_tokens} + {max_new_tokens} of {budget} tokens).")
        return TextDocList(docs=out)
