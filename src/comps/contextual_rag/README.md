# Contextual RAG Microservice

Implements Anthropic's [Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval)
as an ERAG data-prep transform: for every chunk produced by the text splitter, an
LLM writes a short context blurb that situates the chunk within its parent
document, and the blurb is **prepended to the chunk text** before it is embedded.

This is the ingest-time half of the recipe. The query-time half — contextual BM25 fused
with the contextual embeddings by Reciprocal Rank Fusion — lives in the retriever and is
enabled by default alongside this service; see
[Scope](#scope-what-of-the-blog-post-is-implemented-here) and
[Hybrid search](../retrievers/README.md#hybrid-search-contextual-bm25--contextual-embeddings).

## Where it runs in the pipeline

```
text_extractor -> text_compression -> text_splitter -> [contextual_rag] -> embedding -> ingestion
```

It is an **optional** stage, enabled via `CONTEXTUAL_RAG_ENABLED` in the Enhanced
DataPrep (EDP) service. When disabled, the pipeline behaves exactly as before.

## A dedicated blurb model writes the blurbs

The context blurbs are written by a dedicated blurb model, `qwen3-4b-w8a8-blurb`
(`RedHatAI/Qwen3-4B-Instruct-2507-quantized.w8a8`, int8 weights and activations), deployed
next to the pipeline's answer LLM and sized like it — same CPU, memory, replicas and
engine settings as `llama3-8b-awq` — so contextualising documents never takes capacity
from query serving. W8A8 is the 8-bit format vLLM's CPU backend runs (on AMX int8); 8-bit
GPTQ checkpoints do not load on CPU. The service is pointed at the model with two values,
neither of which has a default:

| Variable | Purpose |
|---|---|
| `VLLM_SERVER_ENDPOINT` | OpenAI-compatible base URL, e.g. `http://qwen3-4b-w8a8-blurb-kserve-workload-svc.llm-inference.svc:8000` |
| `CONTEXT_MODEL_NAME` | Model to ask for in the request body — the name it is *served* as |

Both are **mandatory** — the microservice refuses to start without them — but neither is
filled in by hand. Model servers are deployed by `model-manager` (see
[deployment/models.yaml](../../../deployment/models.yaml) and the `app_inference_models`
role), not by this chart, so the deployment resolves them from the `inference_models`
entry with `role: contextual_rag`: `app_inference_models` deploys that model, sizes it
from its catalog entry (outside the query path's replica calculator) and exports
`contextual_rag_endpoint` / `contextual_rag_model_name`, which become
`edp_contextual_rag_endpoint` / `edp_contextual_rag_model_name` and in turn this chart's
`VLLM_SERVER_ENDPOINT` / `CONTEXT_MODEL_NAME`. `app_pre_install` fails the deployment
before anything is installed if contextual RAG is enabled and no such model is declared.

The endpoint is the blurb model's **own KServe Service**, not the AI gateway the query
path goes through. The service decides whether a document fits from the served
`max_model_len` (`/v1/models`) and exact prompt counts (`/tokenize`), and the gateway
serves neither; document-sticky routing also needs the replicas behind that Service.

The blurb model is only busy while documents are ingested. `CONTEXT_MAX_CONCURRENCY`
bounds how many blurb requests one document keeps in flight.

## One request = one source document, contextualised whole or not at all

A request carries the chunks of exactly **one** source document plus that
document's full text. Chunks are never contextualised against a corpus or against
a concatenation of several documents: the blurb would then situate a chunk inside
the wrong document, which is worse than no blurb at all.

The document is **never truncated**. A blurb is only useful if the model saw the chunk's
own document while writing it, and a blurb computed against a cut-down document situates
a chunk in text that does not contain it. So contextualisation is length-constrained:

1. The token budget is `CONTEXT_MAX_PROMPT_TOKENS` (default **16384**, the window
   `qwen3-4b-w8a8-blurb` is served with), capped at the window the LLM is actually served with, read from the
   endpoint's `/v1/models` model card.
2. A document is contextualised only if, for **every** one of its chunks, the blurb
   request — the whole document + the whole chunk + the chat template + `MAX_NEW_TOKENS`
   — fits that budget. Prompt length is measured **exactly** with vLLM's
   `POST /tokenize`, built from the same messages as the generation request.
3. The longest chunk is measured first; if it does not fit, the document is rejected
   after that single call (the usual case for a large document). If it fits, every
   other chunk is measured too, because a chunk with fewer characters can still
   tokenize longer.
4. A document that does not fit is **skipped as a whole**: its chunks are returned
   unchanged and indexed exactly as they would be without contextual RAG. If the server
   rejects a prompt as too long anyway (a window that shrank on restart, or a prompt that
   could only be estimated), the document is skipped the same way — never shortened and
   retried.

With the default budget and `MAX_NEW_TOKENS=100`, 606 of the 607 MultiHop-RAG corpus
documents are contextualised, and 17,389 of their 17,589 chunks (98.9%) get a blurb; the
one document that does not fit is indexed without blurbs. (Measured at ingest with
`qwen3-4b-w8a8-blurb`'s `/tokenize`, 512/64 chunking.) At 8192 the same corpus loses 12
documents, the largest ones, and 10.3% of its chunks.

`/tokenize` is a vLLM extension rather than part of the OpenAI API, so a non-vLLM server
may not serve it. When it is missing the service falls back to a
`CONTEXT_CHARS_PER_TOKEN` estimate deliberately below the English average, so it errs
towards over-counting — towards skipping a document rather than overflowing the budget.

- **Input:** `ContextualRagInput`
  - `docs: List[TextDoc]` — the chunks of one source document.
  - `whole_document: Optional[str]` — the full text the chunks were split from.
    The caller owns this. Reconstructing it by joining the chunks loses whatever
    the splitter dropped and double-counts chunk overlap; when it is omitted the
    service falls back to joining the chunks and logs a warning.
  - `document_id: Optional[str]` — stable id of the source document, used to pin
    all of its chunks to one replica. Defaults to a hash of the document text.
  - `context_model_name`, `max_new_tokens` — optional per-request overrides.
- **Output:** `TextDocList { docs: List[TextDoc] }` — the same chunks, in the same
  order. For a contextualised document the blurb is prepended to `text` and also stored
  in `metadata.context_blurb`, and the original chunk text is preserved verbatim after
  it; for a skipped document the chunks are returned exactly as they came in.

## Prompt

Reproduced verbatim from the blog post:

```
<document>
{whole_document}
</document>
Here is the chunk we want to situate within the whole document
<chunk>
{chunk_content}
</chunk>
Please give a short succinct context to situate this chunk within the overall document for the purposes of improving search retrieval of the chunk. Answer only with the succinct context and nothing else.
```

The document goes **first** and the chunk **last**. That ordering is not cosmetic:
it makes the document a shared prompt prefix, which is what allows the KV cache to
be computed once per document instead of once per chunk. Never move per-chunk text
ahead of the document.

## What makes it fast

Three mechanisms, in the order they matter:

1. **Prompt caching.** The `<document>` block is byte-identical for every chunk of
   a document, so vLLM's automatic prefix caching prefills it once and reuses it.
   This is the blog post's prompt-caching optimisation (which brings the cost down
   to roughly $1.02 per million document tokens). The `llm` category in
   `deployment/models.yaml` already serves models with `--enable-prefix-caching`;
   without it every chunk re-prefills the whole document and ingestion slows down by
   roughly the number of chunks per document.
2. **Prefix warm-up + batching.** The prefix cache only helps requests that arrive
   *after* the prefix is resident, so the first chunk is sent alone to populate the
   cache and the remaining chunks are then fanned out together (up to
   `CONTEXT_MAX_CONCURRENCY`) so vLLM's continuous batcher shares forward passes
   between them. The HTTP connection pool is sized to match the concurrency —
   `requests`' default pool of 10 sockets would otherwise silently serialise it.
3. **Document-sticky routing.** vLLM's prefix cache is *per replica*, so
   round-robin load balancing across N replicas would cut the hit rate to ~1/N.
   Each document is hashed to one replica; parallelism across replicas comes from
   different documents being contextualised concurrently. Replica addresses are read
   from a headless Service (`CONTEXT_VLLM_REPLICA_HOST`, defaulting to
   `<endpoint host>-headless`), refreshed on a TTL, and the mapping is derived from a
   sorted address list so every contextual-rag replica agrees on it. Behind a ClusterIP
   Service or a gateway the lookup simply finds nothing and the configured URL is used,
   leaving replica placement to the server side.

## Configuration (`impl/microservice/.env`)

| Variable | Default | Description |
|---|---|---|
| `VLLM_SERVER_ENDPOINT` | *(none — required)* | OpenAI-compatible endpoint used for blurb generation — in a deployment, the blurb model's KServe Service (`role: contextual_rag`). |
| `CONTEXT_MODEL_NAME` | *(none — required)* | Served name of the LLM that writes the blurbs — in a deployment, `qwen3-4b-w8a8-blurb`. |
| `MAX_NEW_TOKENS` | `100` | Max tokens per blurb. Counted against the budget below. |
| `CONTEXT_MAX_CONCURRENCY` | `32` | Chunks of one document in flight at once. |
| `CONTEXT_MAX_PROMPT_TOKENS` | `16384` | Token budget for one blurb request (whole document + whole chunk + template + `MAX_NEW_TOKENS`). Documents whose requests do not all fit are skipped, never truncated. Capped at the served window; `0` = the whole served window. |
| `CONTEXT_CHARS_PER_TOKEN` | `3.5` | Fallback chars-per-token estimate, used only when `/tokenize` is unreachable. |
| `CONTEXT_REQUEST_TIMEOUT` | `300` | Per-request timeout (seconds). |
| `CONTEXT_MAX_RETRIES` | `2` | Retries per chunk, with exponential backoff. |
| `CONTEXT_STICKY_ROUTING` | `true` | Pin a document's chunks to one replica. Set `false` to always use the configured URL. |
| `CONTEXT_VLLM_REPLICA_HOST` | *(empty)* | Headless Service name. Empty derives `<endpoint host>-headless`, which stays correct if `VLLM_SERVER_ENDPOINT` is repointed. |
| `CONTEXT_VLLM_REPLICA_TTL` | `60` | Seconds between replica DNS refreshes. |
| `CONTEXT_TRUST_ENV_PROXY` | `false` | Sticky routing dials pod IPs, which the container's `no_proxy` (Service names only) does not cover, so `http_proxy` would hijack them. Set `true` only for an external endpoint. |
| `CONTEXTUAL_RAG_USVC_PORT` | `8004` | Service port. |

### Choosing the budget

The budget sets which documents get blurbs, and it bounds what one blurb costs. Every
generated token of a blurb attends over the document's whole cached KV, so the cost of a
blurb grows with the document length; capping the prompt at 16384 tokens keeps that cost
bounded and makes the documents that would be most expensive to contextualise the ones
that are skipped. For `qwen3-4b-w8a8-blurb` (36 layers × 8 KV heads × 128 head dim × 2 × 2
bytes = 144 KiB per token) a 16384-token document prefix is 2.25 GiB of KV cache.
Measured on MultiHop-RAG with this model, raising the budget from 8192 to 16384
contextualises 606 instead of 594 documents; contextual RAG then adds about 21 s to a
document's isolated ingest on average.

A budget above the served window is lowered to it automatically, and logged. To
contextualise longer documents, raise the LLM's `--max-model-len` (and its KV cache
space) together with `CONTEXT_MAX_PROMPT_TOKENS`. Qwen3-4B-Instruct-2507 supports a
262,144-token window natively, so 16384 is a serving choice (KV memory and per-blurb
cost), not a model limit.

## Run locally

```bash
VLLM_SERVER_ENDPOINT=http://localhost:8008 \
CONTEXT_MODEL_NAME=casperhansen/llama-3-8b-instruct-awq \
python erag_contextual_rag_microservice.py
# then
curl -s http://localhost:8004/v1/contextual_rag \
  -H "Content-Type: application/json" \
  -d '{
        "docs": [{"text":"The company revenue grew by 3% over the previous quarter.","metadata":{}}],
        "whole_document": "ACME Corp Q2 2023 results. ... The company revenue grew by 3% over the previous quarter. ...",
        "document_id": "acme-q2-2023"
      }'
```

## Scope: what of the blog post is implemented here

The blog post describes four cumulative steps. This microservice implements the
contextual-embeddings step; the rest live elsewhere in the pipeline:

| Blog component | Reported failure rate | Status |
|---|---|---|
| Baseline embeddings | 5.7% | Default pipeline |
| **Contextual embeddings** | 3.7% (−35%) | **Implemented here** |
| \+ Contextual BM25 with rank fusion | 2.9% (−49%) | **Implemented in the retriever** — `hybrid_search_by_vector()` runs a RediSearch `BM25STD` leg over the same blurb+chunk text as the vector leg and fuses the rankings with weighted RRF. Enabled by default whenever contextual RAG is enabled. See [Hybrid search](../retrievers/README.md#hybrid-search-contextual-bm25--contextual-embeddings). |
| \+ Reranking (top-150 → top-20) | 1.9% (−67%) | Reranker service, fed the fused list (`hybrid_result_k`, default 20) rather than a top-10 cut. |

The full stack is therefore in place: the blurbs written here are what both retrieval
legs index, so the lexical leg is contextual BM25 rather than plain BM25.

Measured on the reference CPU deployment (MultiHop-RAG, 500 randomly sampled queries):
contextual embeddings alone cut retrieval failures **19.9%** (Hits@10 0.628 → 0.702, 67 queries
fixed vs 30 broken, exact McNemar p = 2.2e-04), and adding contextual BM25 with RRF fusion cuts
them **48.4%** (Hits@10 0.808, 110 fixed vs 20 broken, p = 3.0e-16, measured at
`candidate_k=150` / `result_k=50`) — reproducing the post's
−49% for those two stages, on a multi-hop benchmark whose baseline failure rate is 37.2% rather
than 5.7%. The gain is largest on inference queries (Hits@10 0.497 → 0.813), which is the
chunk-lacks-its-document failure mode the blurbs exist to fix. Method and procedure:
[contextual_RAG_integration.md](../../../contextual_RAG_integration.md#2-measured-results).

These figures were measured with a dedicated `Qwen/Qwen3-4B-Instruct-2507` (bf16) blurb
model served with its full window, so every corpus document was contextualised whole. The
shipped configuration — `qwen3-4b-w8a8-blurb` under the 16384-token budget — was re-measured
on 200 MultiHop-RAG queries against a re-measured baseline and the whole-document variant
([report](../../../contextual_RAG_evaluation_200q_Qwen_C_new_variant1.md)): Hits@10 0.805,
MRR@10 0.606 and RAGAS answer correctness 0.597 (baseline 0.785 / 0.572 / 0.592;
whole-document 0.825 / 0.614 / 0.637, statistically level with it), with a full-corpus ingest
of 1.19 h (baseline 0.69 h, whole-document 1.80 h). Against the baseline the gain is not
statistically significant at n = 200.

### Turning the query-time half on and off

Hybrid search follows contextual RAG by default; it is configured with the
`edp_contextual_rag_hybrid_*` keys in the deployment config:

```yaml
inference_models:
  - name: llama3-8b-awq                       # answers queries
    role: llm
  - name: qwen3-4b-w8a8-blurb                 # writes the blurbs; its endpoint and
    role: contextual_rag                      # served name are propagated to EDP
  # ... plus the embedding / reranking entries

edp_contextual_rag_enabled: true
edp_contextual_rag_max_prompt_tokens: 16384       # documents that do not fit get no blurbs
edp_contextual_rag_hybrid_search_enabled: true    # default whenever contextual RAG is on
edp_contextual_rag_hybrid_candidate_k: 100        # candidates from EACH leg before fusion
edp_contextual_rag_hybrid_result_k: 20            # depth of the fused list handed to the reranker
edp_contextual_rag_hybrid_rrf_k: 0                # Anthropic's weight/rank; 60 needs balanced weights
edp_contextual_rag_hybrid_semantic_weight: 0.8
edp_contextual_rag_hybrid_bm25_weight: 0.2
```

Setting `edp_contextual_rag_hybrid_search_enabled: false` gives a contextual-embeddings-only pipeline (the
−35% configuration), which is the right setting when A/B-testing the two halves of the
recipe separately. It requires a Redis or Redis-cluster vector store and needs **no
re-ingest** — both legs read the chunk text that is already indexed.

`kubectl -n chatqa logs deploy/retriever-svc-deployment | grep -i "Hybrid search enabled"`
confirms the query-time half is live; the retriever logs that banner once at start-up.

For the end-to-end integration — every file involved, the flag plumbing and the
evaluation procedure — see
[contextual_RAG_integration.md](../../../contextual_RAG_integration.md).
