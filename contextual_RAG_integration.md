# Contextual RAG Integration

This document describes the integration of **Anthropic's Contextual Retrieval**
([blog post](https://www.anthropic.com/engineering/contextual-retrieval)) into Intel® AI for
Enterprise RAG as an optional, flag-gated module, and lists every file that was added or
changed to do it.

It is written to be self-contained: read section [4](#4-enabling-it) and
[5](#5-deploying-the-stack-with-contextual-rag) to enable and deploy the feature, section
[7](#7-evaluating-the-feature-abc) to reproduce the measurements, and section
[8](#8-complete-change-inventory) to review the diff.

## Table of Contents

- [1. What this adds](#1-what-this-adds)
- [2. Measured results](#2-measured-results)
- [3. Architecture](#3-architecture)
  - [3.1. Ingest time: contextual embeddings](#31-ingest-time-contextual-embeddings)
  - [3.2. Query time: contextual BM25 + rank fusion + reranking](#32-query-time-contextual-bm25--rank-fusion--reranking)
  - [3.3. Flag propagation map](#33-flag-propagation-map)
- [4. Enabling it](#4-enabling-it)
  - [4.1. Declare the blurb model and set the flag](#41-declare-the-blurb-model-and-set-the-flag)
  - [4.2. Full flag reference](#42-full-flag-reference)
  - [4.3. Validation and guardrails](#43-validation-and-guardrails)
- [5. Deploying the stack with contextual RAG](#5-deploying-the-stack-with-contextual-rag)
- [6. Verifying a deployment](#6-verifying-a-deployment)
- [7. Evaluating the feature (A/B/C)](#7-evaluating-the-feature-abc)
- [8. Complete change inventory](#8-complete-change-inventory)
  - [8.1. New files](#81-new-files)
  - [8.2. Modified files](#82-modified-files)
- [9. Design decisions](#9-design-decisions)
- [10. Behaviour when the feature is disabled](#10-behaviour-when-the-feature-is-disabled)
- [11. Tests and lint gates](#11-tests-and-lint-gates)
- [12. Deliberately not included](#12-deliberately-not-included)
- [13. Troubleshooting](#13-troubleshooting)
- [14. References](#14-references)

## 1. What this adds

A chunk taken out of a document loses what it was about. *"The segment's revenue grew 3%"*
does not say which company, which quarter, or which segment — so neither the embedding nor
the lexical index can match it to a question that names them. Anthropic's recipe fixes this
at ingest time and exploits it at query time:

| Stage | Where | What it does | Anthropic's reported gain |
| ----- | ----- | ------------ | ------------------------- |
| Contextual embeddings | ingest | An LLM writes a 50–100 token blurb situating each chunk **inside its own source document**; the blurb is prepended to the chunk before embedding and indexing | −35% retrieval failures |
| Contextual BM25 + rank fusion | query | A lexical BM25 search runs over the same contextualised text; its ranking is fused with the dense ranking by weighted Reciprocal Rank Fusion | −49% |
| Reranking | query | The deep fused list is rescored by the reranker and cut to `top_n` | −67% |

All three stages are covered. The reranker already exists in the ChatQnA pipeline, so
enabling contextual RAG turns on stages 1 and 2 and lets stage 3 operate on a fused list
instead of a 10-item dense list. This combination is referred to as **Setting C** in the
evaluation below.

Everything is behind `edp_contextual_rag_enabled`, which defaults to `false`. With the flag
off, no new pod is deployed, no new environment variable reaches an existing pod, and every
code path added here is skipped — see [section 10](#10-behaviour-when-the-feature-is-disabled).

## 2. Measured results

Reference CPU deployment, MultiHop-RAG, 500 randomly sampled queries, **identical corpus and
identical query set for every setting** (enforced by the parity scripts in
[section 7](#7-evaluating-the-feature-abc)). Setting C was measured at fusion depths
`hybrid_candidate_k = 150` and `hybrid_result_k = 50`; the shipped defaults are the shallower
`100` / `20` (see [section 4.2](#42-full-flag-reference)), so set 150 / 50 to reproduce the
table below exactly:

| Setting | Description | Retrieval failures (1 − Hits@10) | Hits@10 | Relative reduction vs. A |
| ------- | ----------- | -------------------------------- | ------- | ------------------------ |
| **A** | Baseline ERAG (dense retrieval, reranked) | 37.2% | 0.628 | — |
| **B** | A + contextual embeddings (ingest-time blurbs) | 29.8% | 0.702 | −19.9% |
| **C** | B + contextual BM25 + weighted RRF + reranking over the fused list | **19.2%** | **0.808** | **−48.4%** |

- C vs. B alone: retrieval failures 29.8% → 19.2%, i.e. **−35.6%** relative; MAP@10
  0.243 → 0.288.
- Paired per query, C **fixes 74** queries and **breaks 21** against B; exact McNemar
  p = 4.3e-08.
- The reranker's own contribution to Hits@10 flips from **−0.038 to +0.024** once it is fed
  the fused list (`hybrid_result_k = 50` in this run) instead of `k = 10`: given only 10
  candidates it can merely reorder, and drops gold chunks out of the top 10 more often than
  it lifts them in. This is the mechanism behind Anthropic's 49% → 67% step, and it is why
  the default `hybrid_result_k` is kept above `k` even though the shipped value is 20.
- Cost: roughly **+1 s per query** at that depth (mostly the reranker scoring 50 chunks
  instead of 10) and **one LLM call per chunk at ingest time**. The default depth of 20
  costs proportionally less per query.

The measured numbers land close to Anthropic's published −35% / −49%, which is the main
correctness signal that the port behaves like the reference implementation.

**The shipped configuration, re-measured.** The table above was measured with a bf16
`Qwen/Qwen3-4B-Instruct-2507` blurb server contextualising every document whole. The
shipped configuration — the dedicated `qwen3-4b-w8a8-blurb` model, fit-or-skip at the
16384-token budget, `llama3-8b-awq` answering — was re-measured on 200 MultiHop-RAG queries,
on one deployment, against a re-measured baseline and the whole-document implementation
([contextual_RAG_evaluation_200q_Qwen_C_new_variant1.md](contextual_RAG_evaluation_200q_Qwen_C_new_variant1.md)):

| Setting C, 200 queries | Hits@10 | MRR@10 | Answer correctness | Mean TTFT | Full-corpus ingest | Docs without blurbs |
| ---------------------- | ------: | -----: | -----------------: | --------: | -----------------: | ------------------: |
| A — baseline (no contextual RAG) | 0.785 | 0.572 | 0.592 | 2.10 s | 0.69 h | all |
| Whole document, dedicated bf16 blurb server | 0.825 | 0.614 | 0.637 | 2.46 s | 1.80 h | 0 |
| **Shipped: `qwen3-4b-w8a8-blurb`, 16384 budget** | **0.805** | **0.606** | **0.597** | 2.43 s | **1.19 h** | 1 of 607 |

The shipped configuration is statistically level with whole-document contextualisation on
every measure (paired MRR@10 −0.009 [−0.039, +0.022], answer correctness −0.027 [−0.061,
+0.006]) at two thirds of its ingest time, and a large document that does not fit costs one
`/tokenize` call instead of minutes. Against the baseline the gain (Hits@10 16 queries fixed
/ 12 broken, MRR@10 +0.034 [−0.011, +0.079]) is not statistically significant at n = 200;
this re-run's baseline is stronger than the one above because the deployment now hands the
reranker 30 candidates per query in every setting.

## 3. Architecture

### 3.1. Ingest time: contextual embeddings

A new microservice, `src/comps/contextual_rag/`, is inserted into the EDP document pipeline
as **step 4.6**, between text splitting and metadata enrichment:

```text
upload → text extraction → dpguard → text compression → text splitting
                                        │                    │
                                        │ (whole document)   │ (chunks)
                                        └────────┬───────────┘
                                                 ▼
                                    step 4.6  contextual RAG          ◀── NEW, optional
                                    one request per source document
                                                 │
              every chunk: prompt + MAX_NEW_TOKENS ≤ CONTEXT_MAX_PROMPT_TOKENS (16384)?
                                    yes │                      │ no
                                        ▼                      ▼
                         blurb model writes the blurbs   chunks passed through
                         (qwen3-4b-w8a8-blurb, next to    unchanged — never
                          the answer LLM)                 truncated
                                        │                      │
                             text = "blurb\n\nchunk"          │
                                                 ▼
                                     embedding → ingestion → Redis
```

Key properties of the service:

- **One request = one source document.** `ContextualRagInput` carries the document's chunks,
  the `whole_document` text, and a stable `document_id`. Contextual Retrieval situates a
  chunk inside *its own* document, so a request must never mix documents.
- **The blurbs are written by a dedicated blurb model.** `qwen3-4b-w8a8-blurb`
  (`RedHatAI/Qwen3-4B-Instruct-2507-quantized.w8a8`) is declared with
  `role: contextual_rag`, sized like the answer LLM `llama3-8b-awq` and deployed next to
  it, so ingestion never competes with query serving. EDP reaches it through its own
  KServe Service rather than the AI gateway, because the fit check below needs the served
  `max_model_len` and vLLM's `/tokenize`, which the gateway does not serve.
- **Contextualised whole, or not at all — never truncated.** A document is contextualised
  only if, for every one of its chunks, the blurb request (the whole document + the whole
  chunk + the chat template + `max_new_tokens`) fits `CONTEXT_MAX_PROMPT_TOKENS` (default
  16384, the window `qwen3-4b-w8a8-blurb` is served with; capped at the window the server reports in
  `/v1/models`). Prompt length is measured exactly via the server's `/tokenize` endpoint,
  with a `chars_per_token` estimate as fallback. A document that does not fit is skipped:
  its chunks are returned unchanged and indexed as they would be without contextual RAG,
  because a blurb computed against a cut-down document would situate a chunk in text that
  does not contain it. On the MultiHop-RAG corpus the default budget contextualises 606 of
  607 documents, holding 98.9% of the chunks.
- **One /tokenize call rejects a large document.** The longest chunk is measured first; if
  its prompt does not fit, the document is skipped after that single call. If it fits,
  every other chunk is measured too, because a chunk with fewer characters can still
  tokenize longer and the budget is enforced per request.
- **The prompt is document-first** ([`utils/prompt.py`](src/comps/contextual_rag/utils/prompt.py),
  Anthropic's wording reproduced verbatim). The document is a byte-identical prefix for every
  chunk of that document, which is what makes vLLM's automatic prefix caching effective.
- **First-chunk warm-up.** Chunk 1 is sent alone to populate the KV cache, then the remaining
  chunks fan out over a thread pool of `CONTEXT_MAX_CONCURRENCY` workers behind it.
- **Document-sticky routing.** `blake2b(document_id)` selects one model-server replica out of
  the pods behind a headless Service (`<endpoint host>-headless`, TTL-cached), because the
  prefix cache is per replica — round-robin across *N* replicas would cut the hit rate to
  ~1/*N*. Behind a ClusterIP Service or an API gateway the lookup finds nothing and the
  configured URL is used as-is.
- **Context-window safety net.** If the server still rejects a prompt as too long (a window
  that shrank on restart, or a prompt that could only be estimated), the document is
  skipped the same way — never shortened and retried.
- **Output.** For a contextualised document, `text = f"{blurb}\n\n{chunk}"` — the blurb
  becomes part of the text that is embedded *and* indexed, and the original chunk text is
  preserved verbatim after it. The blurb is also stored separately in
  `metadata.context_blurb` for inspection. A skipped document's chunks are returned
  exactly as they came in.

Because the blurb becomes part of the indexed `text` field, **no vector-store schema change
and no re-indexing machinery is required**.

### 3.2. Query time: contextual BM25 + rank fusion + reranking

```text
query → embedding → retriever (search_type "hybrid")
                        ├── dense leg : similarity_search_by_vector, candidate_k=100
                        └── BM25 leg  : RediSearch BM25STD over the same `text` field, candidate_k=100
                                        (contextual BM25 — the indexed text includes the blurb)
                        ▼
              weighted RRF: score += weight / (rrf_k + rank)
                        ▼
              top hybrid_result_k = 20 fused chunks
                        ▼
              reranker → top_n = 5 → LLM
```

- Both legs receive the **identical** `FilterExpression`, so RBAC, bucket/file filters and
  metadata filtering behave the same in each.
- The legs are issued **concurrently** (`asyncio.gather`). The dense leg is authoritative: a
  BM25 failure — or a query that is entirely stopwords — degrades the search to dense-only
  instead of failing the request; a dense-leg failure is raised.
- Only **ranks** are fused, so cosine distance and BM25 scores never have to be normalised
  against each other. Ties break deterministically on per-leg rank.
- Every returned chunk carries provenance: `rrf_score`, `retrieval_source`
  (`hybrid`/`vector`/`bm25`), `vector_rank`, `bm25_rank`, `bm25_score`. A chunk found only by
  the BM25 leg has **no** `vector_distance`, which is why the reranker's late-chunking sort
  path now prefers `rrf_score`.
- `search_type` escape hatches: `"vector"` forces dense-only even where hybrid is enabled;
  `"hybrid"` forces hybrid even where the flag is off. `"similarity"` is upgraded to
  `"hybrid"` when `HYBRID_SEARCH_ENABLED=True`. A `"bm25"` search type is also available for
  A/B measurement.
- `rrf_k` defaults to **0** (Anthropic's `weight / rank`), *not* the canonical RRF constant of
  60. With 60 and the reference 0.8/0.2 weighting the lexical leg becomes inert — the best
  possible BM25-only contribution (`0.2/61`) loses to the *worst* dense contribution in a
  100-candidate pool (`0.8/160`) — so hybrid search would silently degrade to dense-only. Use
  `rrf_k: 60` only with balanced (0.5/0.5) weights.

### 3.3. Flag propagation map

```text
deployment/pipelines/chatqna/config.yaml           (user sets edp_contextual_rag_* here and
        │                                           declares the blurb model in inference_models
        │                                           with role: contextual_rag)
        │
        ├── app_inference_models/tasks/install.yaml      deploy every inference_models entry via
        │                                                model-manager (contextual_rag sized from its
        │                                                catalog entry), then export, from it:
        │                                                  contextual_rag_endpoint  (its own kserve
        │                                                    Service, not the AI gateway)
        │                                                  contextual_rag_model_name
        │                                                (defaults of edp_contextual_rag_endpoint
        │                                                 / _model_name — never hand-configured)
        ├── app_pre_install/tasks/solution_config.yaml   validate: a blurb model must be resolvable;
        │                                                auto-disable hybrid on non-Redis store
        ├── app_pre_install/tasks/load_settings.yaml     print the resolved settings
        │
        ├── app_edp  (ingest half)
        │      defaults/main.yaml  →  templates/values.yaml.j2  →  edp chart
        │            values.yaml (contextualRag.*, textProcessingTimeoutSeconds)
        │              ├── templates/contextualRag/*.yaml        → deployment/svc/hpa/configmap
        │              ├── templates/configmap.yaml              → CONTEXTUAL_RAG_ENABLED,
        │              │                                           CONTEXTUAL_RAG_ENDPOINT,
        │              │                                           TEXT_PROCESSING_TIMEOUT_SECONDS
        │              └── celery env                            → src/edp/app/tasks.py step 4.6
        │
        └── app_pipeline  (query half)
               defaults/main.yaml  →  templates/values.yaml.j2  →  retriever env
                     HYBRID_SEARCH_ENABLED / _CANDIDATE_K / _RESULT_K / _RRF_K /
                     _SEMANTIC_WEIGHT / _BM25_WEIGHT
                       → src/comps/retrievers/erag_retriever_microservice.py
                       → src/comps/vectorstores/utils/connectors/connector_redis.py
```

## 4. Enabling it

### 4.1. Declare the blurb model and set the flag

Contextual RAG needs an LLM to write the blurbs, and it gets a dedicated one:
`qwen3-4b-w8a8-blurb` (`RedHatAI/Qwen3-4B-Instruct-2507-quantized.w8a8`) in
[deployment/models.yaml](deployment/models.yaml), sized like the answer LLM `llama3-8b-awq`
(same CPU, memory, replicas and engine settings) and deployed next to it, so ingestion never
competes with query serving. Enabling the feature is that model's `inference_models` entry
plus a flag in your environment's `env/<name>/config.erag.yaml` (seeded from
[deployment/pipelines/chatqna/config.yaml](deployment/pipelines/chatqna/config.yaml), which
carries the same lines commented out):

```yaml
inference_models:
  - name: llama3-8b-awq       # answers questions
    role: llm
  - name: qwen3-4b-w8a8-blurb # writes the context blurbs
    role: contextual_rag
  - name: nomic-embed
    role: embedding
  - name: bge-reranker-v2-m3
    role: reranking

edp_contextual_rag_enabled: true
edp_contextual_rag_max_prompt_tokens: 16384  # per-request budget; larger documents get no blurbs
```

**No endpoint is configured by hand.** `app_inference_models` deploys each declared model
through `model-manager`, waits for readiness, and propagates the `role: contextual_rag` entry to
`contextual_rag_endpoint` (`http://qwen3-4b-w8a8-blurb-kserve-workload-svc.llm-inference.svc:8000`)
and `contextual_rag_model_name` (`qwen3-4b-w8a8-blurb`), which are the defaults of
`edp_contextual_rag_endpoint` / `edp_contextual_rag_model_name` and reach the microservice as
`VLLM_SERVER_ENDPOINT` / `CONTEXT_MODEL_NAME`. It resolves to the model's own KServe Service
rather than the AI gateway, because the blurb service reads the served `max_model_len` from
`/v1/models` and counts prompts with `/tokenize` to decide exactly whether a document fits,
and the gateway serves neither (see `app_inference_models/files/resolve_model_context_length.py`, which
works around the same gateway limitation for DocSum).

Any other OpenAI-compatible vLLM endpoint can be used instead by setting
`edp_contextual_rag_endpoint` and `edp_contextual_rag_model_name` explicitly (inventory values
override the propagated ones).

The `contextual_rag` role is sized from its catalog entry (or
`inference_default_contextual_rag_*`), not by the query path's replica calculator, which
sizes one vLLM: its cores and memory sit outside the calculator's NUMA and memory
accounting, and `app_inference_models` checks that the node has cores for all four roles.
`edp_contextual_rag_max_concurrency` bounds how many blurb requests one document keeps in
flight.

### 4.2. Full flag reference

Ingest half — [`deployment/roles/app_edp/defaults/main.yaml`](deployment/roles/app_edp/defaults/main.yaml):

| Ansible variable | Default | Chart / env | Purpose |
| ---------------- | ------- | ----------- | ------- |
| `edp_contextual_rag_enabled` | `false` | `contextualRag.enabled`, `CONTEXTUAL_RAG_ENABLED` | Master switch for the ingest half |
| `edp_contextual_rag_endpoint` | `{{ contextual_rag_endpoint }}` *(propagated)* | `VLLM_SERVER_ENDPOINT` | Blurb LLM base URL — the `role: contextual_rag` model's own KServe Service; set only to use an endpoint this solution does not deploy |
| `edp_contextual_rag_model_name` | `{{ contextual_rag_model_name }}` *(propagated)* | `CONTEXT_MODEL_NAME` | Name the LLM is *served* as — resolved from the same entry |
| `edp_contextual_rag_max_new_tokens` | `100` | `MAX_NEW_TOKENS` | Blurb length (Anthropic: 50–100 tokens) |
| `edp_contextual_rag_max_concurrency` | `32` | `CONTEXT_MAX_CONCURRENCY` | Chunks of one document in flight at once |
| `edp_contextual_rag_max_prompt_tokens` | `16384` | `CONTEXT_MAX_PROMPT_TOKENS` | Budget for one blurb request (whole document + whole chunk + template + `max_new_tokens`); documents that do not fit are skipped, never truncated. Capped at the served window; `0` = the whole served window |
| `edp_contextual_rag_chars_per_token` | `3.5` | `CONTEXT_CHARS_PER_TOKEN` | Fallback estimate when `/tokenize` is unreachable |
| `edp_contextual_rag_request_timeout` | `300` | `CONTEXT_REQUEST_TIMEOUT` | Per-LLM-call timeout |
| `edp_contextual_rag_max_retries` | `2` | `CONTEXT_MAX_RETRIES` | Retries per blurb call |
| `edp_contextual_rag_sticky_routing` | `true` | `CONTEXT_STICKY_ROUTING` | Pin a document to one replica for prefix-cache reuse |
| `edp_contextual_rag_replica_host` | `""` | `CONTEXT_VLLM_REPLICA_HOST` | Empty derives `<endpoint host>-headless` |
| `edp_contextual_rag_replica_ttl` | `60` | `CONTEXT_VLLM_REPLICA_TTL` | Seconds a replica-list lookup is cached |
| `edp_contextual_rag_trust_env_proxy` | `false` | `CONTEXT_TRUST_ENV_PROXY` | `true` only for an external endpoint |
| `edp_text_processing_timeout_seconds` | `300` | `TEXT_PROCESSING_TIMEOUT_SECONDS` | Celery per-stage timeout (compression, splitting, contextual RAG) |

Query half — same file, consumed by `app_pipeline`:

| Ansible variable | Default | Retriever env | Purpose |
| ---------------- | ------- | ------------- | ------- |
| `edp_contextual_rag_hybrid_search_enabled` | `true` | `HYBRID_SEARCH_ENABLED` | Fuse BM25 with dense retrieval (Redis only) |
| `edp_contextual_rag_hybrid_candidate_k` | `100` | `HYBRID_SEARCH_CANDIDATE_K` | Candidates from **each** leg before fusion (raised to `k` when smaller) |
| `edp_contextual_rag_hybrid_result_k` | `20` | `HYBRID_SEARCH_RESULT_K` | Depth of the fused list handed to the reranker (must stay above `k`) |
| `edp_contextual_rag_hybrid_rrf_k` | `0` | `HYBRID_SEARCH_RRF_K` | RRF smoothing; `0` = Anthropic's `weight / rank` |
| `edp_contextual_rag_hybrid_semantic_weight` | `0.8` | `HYBRID_SEARCH_SEMANTIC_WEIGHT` | Weight of the dense leg |
| `edp_contextual_rag_hybrid_bm25_weight` | `0.2` | `HYBRID_SEARCH_BM25_WEIGHT` | Weight of the lexical leg |

The `HYBRID_SEARCH_*` values are only **defaults**: any of these parameters sent in a
retrieval request wins, and they can be changed at runtime from the Control Plane Admin Panel
(they are part of `RetrieverParams` in the system fingerprint).

The last stage of the funnel is the reranker's own `top_n`, raised from `3` to **`5`** in
`RerankerParams` and `SearchedDoc` so the fused list is cut to five chunks before the prompt
is built. It is not a contextual-RAG flag — it applies to every pipeline — and is likewise
tunable at runtime from the Admin Panel. The full default funnel is therefore
`candidate_k 100 per leg → result_k 20 fused → top_n 5 reranked`.

### 4.3. Validation and guardrails

- **`app_pre_install` fails the deployment** when `edp_contextual_rag_enabled: true` and no
  blurb model could be resolved — i.e. no `inference_models` entry declares
  `role: contextual_rag` *and* no explicit `edp_contextual_rag_endpoint` was given. Silently ingesting documents without
  blurbs would produce a corpus that looks contextualised but is not. The check runs here
  because `components.yaml` makes `app_pre_install` depend on `app_inference_models`, so the
  propagated values already exist by then.
- The chart repeats the check with Helm `required` on
  `contextualRag.config.vllm_endpoint` / `.context_model_name`, so a hand-written
  `values.yaml` cannot bypass it either. The microservice itself refuses to start without
  them.
- **Hybrid search is auto-disabled on a non-Redis vector store** (a `set_fact` in
  `solution_config.yaml`, plus a store guard in the `app_pipeline` template). The lexical leg
  is a RediSearch full-text query; no other supported store provides one. Contextual
  embeddings still work, so this degrades the feature instead of failing the deployment.
- `app_pre_install/tasks/load_settings.yaml` prints `Contextual RAG`, the resolved blurb
  LLM + endpoint, the prompt budget, and `Contextual RAG Hybrid Search` in the pre-install
  settings summary.

## 5. Deploying the stack with contextual RAG

A redeploy from a clean state, end to end:

1. **Build and push the new image.** It is registered in
   [deployment/images.yaml](deployment/images.yaml) as `contextualRagUsvc` →
   `enterprise-rag-contextual-rag`, built from
   `src/comps/contextual_rag/impl/microservice/Dockerfile` with `src` as context, so the
   normal image build flow ([docs/reference/docker_images.md](docs/reference/docker_images.md),
   `deployment/update_images.sh`) picks it up with no extra arguments.

2. **The blurb model is deployed with the rest.** `qwen3-4b-w8a8-blurb`
   ([deployment/models.yaml](deployment/models.yaml)) is the `role: contextual_rag` entry
   `app_inference_models` deploys: W8A8 int8 weights and activations, the 8-bit format vLLM's
   CPU backend runs, served with a 16384-token window and `--enable-prefix-caching`, which is
   what makes one call per chunk affordable: a document's prefix is prefilled once and reused
   for every chunk. Its KV cache is 36 layers × 8 KV heads × 128 head dim × 2 × 2 bytes =
   144 KiB per token, so a full 16384-token document prefix is 2.25 GiB.

3. **Set `edp_contextual_rag_enabled: true` and declare the blurb model** in the same config
   as in [section 4.1](#41-declare-the-blurb-model-and-set-the-flag). There is no endpoint or
   model name to add.

4. **Run the installation** exactly as documented in
   [docs/deploy/install_rag.md](docs/deploy/install_rag.md):

   ```bash
   ./es_auto_installer.sh install erag --env <name>
   ```

   This is the only command needed. `app_inference_models` deploys the blurb model next to
   the answer LLM and exports its KServe Service as the blurb endpoint, `app_pre_install` validates that one was
   resolvable, `app_edp`
   renders `contextualRag.enabled: true` into the EDP chart (deployment, service, HPA,
   ConfigMap, ServiceMonitor, celery env) with the propagated endpoint and model name, and
   `app_pipeline` renders the `HYBRID_SEARCH_*` environment into the retriever.

5. **Ingest documents.** Documents ingested *before* the feature was enabled keep their
   un-contextualised embeddings — contextualisation happens at ingest time, so an existing
   corpus must be re-ingested to benefit. For evaluation, re-ingest **per document** (see
   [section 7](#7-evaluating-the-feature-abc)).

What gets deployed when the flag is on:

| Object | Name | Notes |
| ------ | ---- | ----- |
| Deployment | `edp-contextual-rag` | Port 8004, liveness/readiness/startup probes on `v1/health_check`, init container that waits for `$VLLM_SERVER_ENDPOINT/v1/models` |
| Service | `edp-contextual-rag` | ClusterIP, 8004 |
| ConfigMap | `edp-contextual-rag-configmap` | All `CONTEXT_*` / `VLLM_SERVER_ENDPOINT` settings |
| HPA | `edp-contextual-rag` | `hpa_enabled` only; scales on `edp_backend_files_to_upload`, 1–2 replicas |
| ServiceMonitor | `edp-contextual-rag-svc` | `monitoring.enabled` only |
| Celery env | `CONTEXTUAL_RAG_ENABLED`, `CONTEXTUAL_RAG_ENDPOINT`, `TEXT_PROCESSING_TIMEOUT_SECONDS` | From `edp-configmap` |
| Retriever env | `HYBRID_SEARCH_*` | Rendered by `app_pipeline` |

`edp-contextual-rag` is also added to the chart's `no_proxy` container list.

## 6. Verifying a deployment

```bash
# 1. the pod is up
kubectl -n edp get pods -l app.kubernetes.io/name=edp-contextual-rag

# 2. the celery worker sees the feature
kubectl -n edp get configmap edp-configmap \
  -o jsonpath='{.data.CONTEXTUAL_RAG_ENABLED}{"\n"}{.data.CONTEXTUAL_RAG_ENDPOINT}{"\n"}'

# 3. the retriever runs hybrid search
kubectl -n chatqna get deploy retriever -o jsonpath='{.spec.template.spec.containers[0].env}' \
  | tr ',' '\n' | grep -i HYBRID

# 4. ingest one document, then check the blurbs were written
kubectl -n edp logs deploy/edp-contextual-rag | grep Contextualized
# -> Contextualized 42 chunk(s) of document <id> in 18.3s via http://... (~9120 prompt tokens, full document in prompt).

# 5. confirm fusion is actually fusing
kubectl -n chatqna logs deploy/retriever | grep 'Hybrid search fused'
# -> Hybrid search fused 100 vector + 100 BM25 candidates (31 in both) into 20 result(s); rrf_k=0, ...
```

A retrieved chunk's metadata is the other end-to-end signal: `context_blurb` proves the
ingest half ran, and `rrf_score` / `retrieval_source` prove the query half did.

## 7. Evaluating the feature (A/B/C)

The evaluation harness under
[src/tests/e2e/evals/evaluation/rag_eval/](src/tests/e2e/evals/evaluation/rag_eval/) was
extended so that an A/B/C comparison is reproducible. See its
[README](src/tests/e2e/evals/evaluation/rag_eval/README.md#comparing-two-configurations-ab-evaluation)
for the authoritative usage guide.

**Per-document ingestion is mandatory for a valid comparison.** The harness used to upload the
MultiHop corpus as one concatenated file, which makes every stage treat the whole corpus as a
single pseudo-document: the contextual-RAG service would then situate each chunk inside "the
corpus" rather than inside its own document, and retrieval metrics keyed on `doc_id` become
meaningless. `eval_multihop.py --ingest_docs` now writes one `tmp_corpus_docs/*.txt` per corpus
document (index-prefixed, slugified title) and uploads them in batches through
`Evaluator.ingest_docs_individually()`, which waits for every file to reach a terminal status
and fails on more than `--ingest_max_failures` failures.

New arguments: `--ingest_batch_size` (64), `--ingest_timeout` (14400),
`--ingest_max_failures` (0).

Four helper scripts in
[examples/](src/tests/e2e/evals/evaluation/rag_eval/examples/):

| Script | Purpose |
| ------ | ------- |
| `clean_corpus.py` | Deletes every EDP file and link and waits until the corpus is empty, so a run cannot retrieve vectors left by the previous setting |
| `enforce_corpus_parity.py` | Writes (`--write-snapshot`) or enforces a snapshot of the ingested document set; deletes surplus documents, fails on missing ones |
| `reingest_documents.py` | Cancels, deletes and re-uploads named documents — or `--stuck`, everything left in a non-terminal state |
| `compare_crag_settings.py` | Folds each run's generation/RAGAS/retrieval passes into one report, then reports deltas, the retrieval failure rate (1 − Hits@10) and an **exact McNemar test** on paired per-query Hits@10 |

A full cycle per setting:

```bash
# 1. start from an empty corpus
python clean_corpus.py

# 2. ingest one file per corpus document, then evaluate
python eval_multihop.py --ingest_docs --retrieval_metrics --limits 500 2>&1 | tee output/C.log
mv output/multihop_*.json output/report_C.json

# 3. pin the document set of the first run and enforce it on the others
python enforce_corpus_parity.py --snapshot output/corpus_snapshot.json --write-snapshot
python enforce_corpus_parity.py --snapshot output/corpus_snapshot.json   # on later runs

# 4. compare
python compare_crag_settings.py \
    --setting B=output/report_B.json --setting C=output/report_C.json \
    --compare C:B --out output/comparison.json
```

`compare_crag_settings.py` reads the generation and RAGAS aggregates from the run log, so each
run must be piped through `tee` into `output/<setting>.log`; without it only the last pass's
metrics survive in the report's `overall` block.

Mapping the settings onto flags:

| Setting | `edp_contextual_rag_enabled` | `edp_contextual_rag_hybrid_search_enabled` |
| ------- | ---------------------------- | ------------------------------------------ |
| A | `false` | n/a |
| B | `true` | `false` |
| C | `true` | `true` |

A and B differ in the *index*, so switching between them requires a `clean_corpus.py` +
re-ingest. B and C differ only at query time, so C can reuse B's index — which is exactly why
the B↔C comparison can be paired per query.

Setting C in [section 2](#2-measured-results) was run at `edp_contextual_rag_hybrid_candidate_k: 150`
and `edp_contextual_rag_hybrid_result_k: 50`, above the shipped defaults of `100` / `20`. Set
both explicitly when reproducing those figures, and record whichever depths a new run used —
the fused-list depth is the single parameter the C-vs-B gap is most sensitive to.

## 8. Complete change inventory

Against `main`: **41 files modified (+1947 / −81) and 54 files added** (the 53
listed below plus this document), none of them outside this repository. For the changes made
since the previously reviewed revision, file by file, see
[Contextual_RAG_new_implementaion.md](Contextual_RAG_new_implementaion.md).

### 8.1. New files

**Microservice** — `src/comps/contextual_rag/`:

| File | Lines | Purpose |
| ---- | ----: | ------- |
| `erag_contextual_rag_microservice.py` | 90 | FastAPI microservice: `POST /v1/contextual_rag`, `ContextualRagInput` → `TextDocList`, `ValueError` → HTTP 400, everything else → 500, latency statistics registered |
| `utils/erag_contextual_rag.py` | 457 | `EragContextualRag`: replica discovery and document-sticky routing, served-window detection (`/v1/models`) and the `CONTEXT_MAX_PROMPT_TOKENS` budget capped at it, exact prompt measurement (`/tokenize`) with `chars_per_token` fallback, the fit-or-skip check over every chunk (never truncates), blurb generation with retries, first-chunk cache warm-up, skip-on-`ContextLengthExceeded`, blurb prepending |
| `utils/prompt.py` | 22 | Anthropic's prompt, verbatim, document-first (the ordering that makes prefix caching work) |
| `README.md` | 277 | Component documentation: pipeline position, the dedicated blurb model and how its endpoint is propagated from `inference_models`, the one-request-per-document / fit-or-skip contract, prompt, performance mechanics, `.env` reference, choosing the prompt budget, local run, scope vs. the blog post |
| `impl/microservice/.env` | 53 | Defaults for every `CONTEXT_*` setting, with the reasoning for each |
| `impl/microservice/Dockerfile` | 47 | Build, matching the other `comps` microservices (`src` context) |
| `impl/microservice/Dockerfile.release` | 11 | Release variant |
| `impl/microservice/pyproject.toml` | 46 | `uv` project + `test` extra |
| `impl/microservice/uv.lock` | — | Locked dependencies (generated) |
| `impl/microservice/compliance-conf.yml` | 28 | Compliance metadata, as for the other components |
| `impl/microservice/.dockerhub/overview.md`, `short-description.txt` | — | Docker Hub metadata |

**Helm chart** — `deployment/components/edp/templates/`:

| File | Lines | Purpose |
| ---- | ----: | ------- |
| `contextualRag/contextual-rag-deployment.yaml` | 125 | Deployment, all-`if .Values.contextualRag.enabled`-gated; init container waits for the blurb endpoint's `/v1/models`; probes on `v1/health_check`; `envFrom` the new ConfigMap |
| `contextualRag/contextual-rag-configmap.yaml` | 42 | `edp-contextual-rag-configmap`; `required` on `contextualRag.config.vllm_endpoint` and `.context_model_name`, both propagated by Ansible |
| `contextualRag/contextual-rag-service.yaml` | 20 | ClusterIP on 8004 |
| `contextualRag/contextual-rag-hpa.yaml` | 52 | HPA on `edp_backend_files_to_upload`, same shape as the other EDP components |
| `monitoring/servicemonitor-edp-contextual-rag.yaml` | 20 | ServiceMonitor, gated on `monitoring.enabled` |

**Tests** — `src/tests/unit/contextual_rag/`:

| File | Lines | Purpose |
| ---- | ----: | ------- |
| `test_erag_contextual_rag.py` | 500 | 45 tests: prompt-budget default, cap at the served window and `0`; served-window detection; exact `/tokenize` measurement, its fallback and when it latches off; fit-or-skip at the exact budget boundary, over every chunk, one-call rejection of large documents; skipping (chunks returned unchanged) on a misfit or a server rejection; the whole document always sent; sticky routing and replica selection; retries; first-chunk warm-up; blurb prepending; metadata preservation; degraded `whole_document` fallback; two end-to-end runs against a fake server |
| `test_erag_contextual_rag_microservice.py` | 170 | 9 tests: registration, input/output datatypes, environment wiring (incl. the 16384 default budget), error mapping, empty input |
| `__init__.py` | 2 | Package marker |

**Evaluation helpers and results** — `src/tests/e2e/evals/evaluation/rag_eval/examples/`, plus
the report at the repository root:

| File | Lines | Purpose |
| ---- | ----: | ------- |
| `compare_crag_settings.py` | 289 | Log scraping, report folding, deltas, failure-rate reduction, exact McNemar, supplementary per-setting view, JSON output |
| `enforce_corpus_parity.py` | 134 | Snapshot write/enforce for corpus parity between runs |
| `reingest_documents.py` | 125 | Re-ingest named or stuck documents |
| `clean_corpus.py` | 84 | Delete all files/links, wait for empty |
| `sample_queries.py` | 142 | Deterministic random query sample (seeded), written as a manifest so A, B and C answer the same questions |
| `measure_latency.py` | 304 | Per-setting TTFT and inter-token latency over the sampled queries |
| `contextualization_stats.py` | 180 | Per-chunk and per-document contextualisation time scraped from the EDP celery logs |
| `verify_blurb_coverage.py` | 228 | Confirms every indexed chunk in B and C carries a blurb (and none in A) |
| `results/multihop_200q/*.json` | — | The 200-query run's raw artefacts: sample manifest, A/B/C comparison, latency per setting, contextualisation timings, blurb coverage. Read by [contextual_RAG_evaluation_200q.md](contextual_RAG_evaluation_200q.md) |
| `results/multihop_200q_qwen_c_new_variant1/*` | — | That evaluation's raw artefacts (15 files): paired tests, blurb coverage and length, contextualisation and ingest timings, latency, RAGAS failures, the blurb deployment used |
| [contextual_RAG_evaluation_200q.md](contextual_RAG_evaluation_200q.md) | 317 | The 200-query evaluation report: A/B/C accuracy table, contextualisation cost, TTFT and next-token latency |
| [contextual_RAG_evaluation_200q_Qwen_C_new_variant1.md](contextual_RAG_evaluation_200q_Qwen_C_new_variant1.md) | 162 | The 200-query evaluation of the shipped configuration (dedicated W8A8 blurb model, 16384 budget) against a re-measured baseline and the whole-document implementation: accuracy, paired tests, coverage, ingest cost, TTFT |
| [Contextual_RAG_new_implementaion.md](Contextual_RAG_new_implementaion.md) | 462 | Review guide for the second revision: the dedicated blurb model, the fit-or-skip prompt budget and the two fixes, file by file, with verification and open points |

### 8.2. Modified files

**Core protocol and constants**

| File | +/− | Change |
| ---- | --- | ------ |
| [src/comps/cores/mega/constants.py](src/comps/cores/mega/constants.py) | +2 | `ServiceType.CONTEXTUAL_RAG = 38`; `MegaServiceEndpoint.CONTEXTUAL_RAG = "/v1/contextual_rag"` |
| [src/comps/cores/proto/docarray.py](src/comps/cores/proto/docarray.py) | +36 −1 | Five hybrid-search fields on `EmbedDoc` (`hybrid_candidate_k` = 100, `hybrid_result_k` = 20, `rrf_k` = 0, `semantic_weight` = 0.8, `bm25_weight` = 0.2 — Anthropic's `weight/rank` fusion at a shallower funnel); `SearchedDoc.top_n` default raised `3` → `5`; new `ContextualRagInput` (`docs`, `whole_document`, `document_id`, per-request `context_model_name` / `max_new_tokens`) |
| [src/comps/cores/proto/api_protocol.py](src/comps/cores/proto/api_protocol.py) | +9 −2 | Same five fields on `RetrievalRequest`; `NonNegativeInt` import; `search_type` comment |

**Retrieval path**

| File | +/− | Change |
| ---- | --- | ------ |
| [src/comps/vectorstores/utils/connectors/connector_redis.py](src/comps/vectorstores/utils/connectors/connector_redis.py) | +318 −5 | `bm25_search()` (RediSearch `BM25STD` over the existing `text` field), `_build_text_query()`, `_has_lexical_tokens()` (stopword-only queries), `_return_fields()`, `_reciprocal_rank_fusion()` (weighted, `weight/(rrf_k+rank)`), `hybrid_search_by_vector()` (concurrent legs, dense authoritative, deterministic tie-breaking, provenance metadata) |
| [src/comps/vectorstores/utils/connectors/connector.py](src/comps/vectorstores/utils/connectors/connector.py) | +13 | Base-class stubs + docstrings for `bm25_search` / `hybrid_search_by_vector`, so non-Redis connectors raise `NotImplementedError` (HTTP 501) instead of `AttributeError` |
| [src/comps/vectorstores/utils/erag_vectorstore.py](src/comps/vectorstores/utils/erag_vectorstore.py) | +31 −1 | `search()` dispatch for `"hybrid"` and `"bm25"`; `"vector"` accepted as an alias of `"similarity"`; the fused list is fetched at `max(k, hybrid_result_k)` depth so the reranker gets the deep list; docstring of the supported search types |
| [src/comps/retrievers/erag_retriever_microservice.py](src/comps/retrievers/erag_retriever_microservice.py) | +68 −3 | `HYBRID_SEARCH_ENABLED` + `HYBRID_SEARCH_ENV_DEFAULTS`; `apply_hybrid_search_defaults()` upgrades `"similarity"` → `"hybrid"` and fills only the fields the caller did not send (explicit request values always win); `request.json()` moved earlier; debug logging falls back to `rrf_score` when there is no `vector_distance` |
| [src/comps/retrievers/impl/microservice/.env](src/comps/retrievers/impl/microservice/.env) | +12 | The six `HYBRID_SEARCH_*` defaults, documented |
| [src/comps/reranks/utils/erag_reranking.py](src/comps/reranks/utils/erag_reranking.py) | +11 −3 | `_filter_top_n_by_vector_distance()` prefers a negated `rrf_score` when present, so the late-chunking path (which bypasses the reranker model and sorts on retrieval score) orders fused documents correctly and does not treat BM25-only chunks as infinitely distant |
| [src/comps/system_fingerprint/utils/object_document_mapper.py](src/comps/system_fingerprint/utils/object_document_mapper.py) | +14 −2 | The five hybrid knobs on `RetrieverParams`, so they are persisted, visible and editable at runtime from the Control Plane Admin Panel; `RerankerParams.top_n` default raised `3` → `5` |

**Ingest path**

| File | +/− | Change |
| ---- | --- | ------ |
| [src/edp/app/tasks.py](src/edp/app/tasks.py) | +51 | `CONTEXTUAL_RAG_ENDPOINT`; `source_document_text` captured from the compression output (the exact text the splitter is about to cut) in both tasks; "Step 4.6" block in `process_file_task` **and** `process_link_task`: one POST per document with `docs` + `whole_document` + `document_id`, error → file/link status `error` with a message, success → replaces `dataprep_docs` and updates `chunks_total` |
| [src/edp/tests/test_tasks.py](src/edp/tests/test_tasks.py) | +6 −2 | The two `process_*_task_success` fixtures returned bare strings for the compression service's `loaded_docs`, which the old code never inspected. They now use the real `TextSplitterInput.loaded_docs` shape (`List[TextDoc]`, i.e. dicts with a `text` field), which is what step 4.6 reads |

**Deployment**

| File | +/− | Change |
| ---- | --- | ------ |
| [deployment/components/edp/values.yaml](deployment/components/edp/values.yaml) | +101 | New `contextualRag` block (image, replicas, resources, HPA, and a fully commented `config` section documenting that the endpoint and model name arrive by propagation); `textProcessingTimeoutSeconds`; three new celery env entries (`CONTEXTUAL_RAG_ENABLED`, `CONTEXTUAL_RAG_ENDPOINT`, `TEXT_PROCESSING_TIMEOUT_SECONDS`) |
| [deployment/components/edp/templates/configmap.yaml](deployment/components/edp/templates/configmap.yaml) | +7 | `CONTEXTUAL_RAG_ENABLED`, `CONTEXTUAL_RAG_ENDPOINT` (empty unless enabled), `TEXT_PROCESSING_TIMEOUT_SECONDS` |
| [deployment/components/edp/templates/_helpers.tpl](deployment/components/edp/templates/_helpers.tpl) | +15 −1 | `helm-edp.contextualRag.name` / `.selectorLabels`, the `manifest.podLabels` branch, and `edp-contextual-rag` in `noProxyWithContainers` |
| [deployment/images.yaml](deployment/images.yaml) | +4 | `contextualRagUsvc` → `contextual-rag` image, so the standard build flow builds and pushes it |
| [deployment/roles/app_inference_models/tasks/install.yaml](deployment/roles/app_inference_models/tasks/install.yaml) | +76 −11 | Adds the `contextual_rag` role: validated (known roles, one model per role and name), sized from its catalog entry outside the replica calculator, counted in the best-effort core check and bound after embedding; exports `contextual_rag_endpoint` / `contextual_rag_model_name` from it — the blurb model's own `*-kserve-workload-svc` address rather than the AI gateway, which serves neither `/tokenize` nor `max_model_len` — so the blurb endpoint propagates instead of being typed in |
| [deployment/roles/app_inference_models/defaults/main.yaml](deployment/roles/app_inference_models/defaults/main.yaml) | +35 −1 | Documents the model roles; `inference_known_roles` and the `inference_default_contextual_rag_*` sizing defaults (32 CPU / 24Gi / 1 replica, as `llama3-8b-awq`) |
| [deployment/roles/app_edp/defaults/main.yaml](deployment/roles/app_edp/defaults/main.yaml) | +97 | Every `edp_contextual_rag_*` variable (ingest and hybrid halves) plus `edp_text_processing_timeout_seconds`, each with the rationale for its default — notably `edp_contextual_rag_max_prompt_tokens: 16384` and the fit-or-skip rule; `edp_contextual_rag_endpoint` / `_model_name` default to the propagated `contextual_rag_*` facts (the blurb model), with the inventory override documented as the escape hatch |
| [deployment/roles/app_edp/templates/values.yaml.j2](deployment/roles/app_edp/templates/values.yaml.j2) | +29 | `textProcessingTimeoutSeconds`; the `contextualRag:` block, rendered only when the feature is enabled |
| [deployment/roles/app_pipeline/defaults/main.yaml](deployment/roles/app_pipeline/defaults/main.yaml) | +9 | The cross-role defaults `app_pipeline` needs to render the retriever environment |
| [deployment/roles/app_pipeline/templates/values.yaml.j2](deployment/roles/app_pipeline/templates/values.yaml.j2) | +16 | `HYBRID_SEARCH_*` on the retriever, gated on contextual RAG + hybrid flag + a Redis vector store |
| [deployment/roles/app_pre_install/defaults/main.yaml](deployment/roles/app_pre_install/defaults/main.yaml) | +6 | `contextual_rag_endpoint` / `contextual_rag_model_name` in the cross-role shared defaults, so this role renders standalone and the checks below read a defined value |
| [deployment/roles/app_pre_install/tasks/solution_config.yaml](deployment/roles/app_pre_install/tasks/solution_config.yaml) | +61 | Two hard failures — no blurb model could be resolved (no `role: contextual_rag` entry and nothing set explicitly), and an endpoint set by hand with no model name — plus the non-Redis hybrid auto-disable |
| [deployment/roles/app_pre_install/tasks/load_settings.yaml](deployment/roles/app_pre_install/tasks/load_settings.yaml) | +6 | Contextual RAG / blurb LLM / prompt budget / hybrid search in the pre-install summary, falling back to the propagated values |
| [deployment/models.yaml](deployment/models.yaml) | +24 | The `qwen3-4b-w8a8-blurb` entry (`RedHatAI/Qwen3-4B-Instruct-2507-quantized.w8a8`): sized like `llama3-8b-awq`, `--max-model-len 16384`, prefix caching |
| [deployment/pipelines/chatqna/config.yaml](deployment/pipelines/chatqna/config.yaml) | +21 | A ready-to-uncomment `qwen3-4b-w8a8-blurb` / `role: contextual_rag` entry and flag block explaining that the dedicated model writes the blurbs and that larger documents are skipped — no endpoint to add |

**Documentation**

| File | +/− | Change |
| ---- | --- | ------ |
| [docs/customize/models.md](docs/customize/models.md#contextual-rag) | +40 | "Accuracy tuning → Contextual RAG": what it is, both halves, enablement with the dedicated blurb model, the fit-or-skip budget, drawbacks, measured results |
| [docs/customize/configuration.md](docs/customize/configuration.md) | +4 −1 | The `contextual_rag` role, the `edp_contextual_rag_enabled` / `_max_prompt_tokens` rows and the template line |
| [src/comps/retrievers/README.md](src/comps/retrievers/README.md) | +81 −2 | Six `HYBRID_SEARCH_*` rows, `vector`/`hybrid` search-type rows, and the "Hybrid Search: contextual BM25 + contextual embeddings" section (recipe, Anthropic figures, measured numbers, the `rrf_k=0` note, failure behaviour, per-request overrides, provenance metadata) |
| [src/comps/vectorstores/README.md](src/comps/vectorstores/README.md) | +32 | `vector`/`hybrid` rows and a "Hybrid search (`hybrid`)" subsection with the five-parameter table and implementation notes |
| [src/comps/reranks/README.md](src/comps/reranks/README.md) | +21 −1 | "Documents produced by hybrid search": why normal reranking needs no special handling and why the late-chunking sort path reads `rrf_score`; the documented `top_n` default follows the code to `5` |
| [src/tests/e2e/evals/evaluation/rag_eval/README.md](src/tests/e2e/evals/evaluation/rag_eval/README.md) | +43 −1 | The three new ingestion arguments, the `tmp_corpus_docs/` note, and the "Comparing Two Configurations (A/B Evaluation)" section |

**Evaluation harness**

| File | +/− | Change |
| ---- | --- | ------ |
| [src/tests/e2e/evals/evaluation/rag_eval/evaluator.py](src/tests/e2e/evals/evaluation/rag_eval/evaluator.py) | +116 −22 | `ingest_docs()` replaced by `ingest_docs_individually()`: batched parallel upload, then polling until every file reaches a terminal status, with progress logging, a timeout, and a `max_failed_files` gate; returns `{"ingested": [...], "failed": [...]}`. A comment records why the single-file variant was removed |
| [src/tests/e2e/evals/evaluation/rag_eval/examples/eval_multihop.py](src/tests/e2e/evals/evaluation/rag_eval/examples/eval_multihop.py) | +76 −22 | `slugify()` and `write_corpus_documents()` (one index-prefixed `.txt` per corpus document); `--ingest_docs` now writes `tmp_corpus_docs/` and calls `ingest_docs_individually()`; `--ingest_batch_size` / `--ingest_timeout` / `--ingest_max_failures`; `default_auth_file()` / `default_cluster_config_dir()` shared with the four helper scripts |

**Test and CI registration**

| File | +/− | Change |
| ---- | --- | ------ |
| [src/tox.ini](src/tox.ini) | +15 | `[testenv:contextual_rag_unit_tests]`, same shape as the other component envs |
| [.github/workflows/val-unit-tests.yml](.github/workflows/val-unit-tests.yml) | +1 | `contextual_rag_unit_tests` in the CI matrix |
| [src/tests/unit/vectorstores/test_erag_connector_redis.py](src/tests/unit/vectorstores/test_erag_connector_redis.py) | +223 | BM25 query building, stopword-only queries, RRF weighting and `rrf_k` behaviour, hybrid fusion, leg-failure degradation, provenance metadata, both-weights-zero `ValueError` |
| [src/tests/unit/vectorstores/test_erag_vectorstore.py](src/tests/unit/vectorstores/test_erag_vectorstore.py) | +63 | `search()` dispatch for `hybrid`/`bm25`/`vector` and the `max(k, hybrid_result_k)` depth |
| [src/tests/unit/retrievers/test_erag_retriever_microservice.py](src/tests/unit/retrievers/test_erag_retriever_microservice.py) | +120 | `apply_hybrid_search_defaults()`: the `similarity` → `hybrid` upgrade, per-request precedence, invalid env values, the `vector` escape hatch, flag-off behaviour |
| [src/tests/unit/reranks/test_utils_erag_reranking.py](src/tests/unit/reranks/test_utils_erag_reranking.py) | +34 | `rrf_score` ordering, mixed fused/non-fused documents, missing-score fallback |

## 9. Design decisions

- **A separate microservice, not a step inside the splitter or the embedder.** It follows the
  existing `src/comps/<component>` layout, scales independently (it is LLM-bound, unlike every
  other EDP stage), and keeps the blurb LLM's configuration out of components that must keep
  working when the feature is off.
- **Reuse the existing `text` field for BM25.** RediSearch already indexes chunk text as
  `TEXT`, so contextual BM25 needs no second index, no schema migration and no re-ingest to
  turn *the query half* on or off. That is also what makes B↔C a paired comparison over one
  index.
- **Fuse ranks, not scores.** Cosine distance and BM25 are not on comparable scales; RRF only
  needs the ordering, which removes an entire class of normalisation bugs.
- **`rrf_k = 0`, and it is documented loudly.** Matching Anthropic's `weight / rank` is what
  reproduces their numbers; the canonical 60 silently disables the lexical leg at the
  reference weights. This trap is called out in the code, the `.env`, the chart values, the
  Ansible defaults and three READMEs, because a silent degradation to dense-only would look
  like "hybrid search does not help".
- **Default funnel `100 → 20 → 5`, not Anthropic's `150 → 20`.** The shipped defaults keep the
  mechanism (a candidate pool much deeper than `k`, and a fused list deeper than `k` handed to
  the reranker) while keeping the per-query cost modest for a general-purpose deployment: the
  reranker scores every fused chunk, so `hybrid_result_k` is the dominant latency term, and
  `top_n = 5` bounds how much of that list reaches the prompt. All three are single-value
  changes in the config, so a recall-first deployment can move to the measured 150 / 50.
- **Fetch `hybrid_result_k` (20 by default) rather than `k` (10) from the store.** The
  reranker is what narrows the list. Handing it only 10 candidates was measured to make its
  contribution to Hits@10 *negative*; this single choice accounts for most of the difference
  between the 49% and 67% figures. The measurement in [section 2](#2-measured-results) used a
  depth of 50 — the default trades some of that headroom for query latency, since the reranker
  scores every fused chunk.
- **Mandatory endpoint and model name, enforced in three places.** Ansible fails fast, Helm
  `required` blocks hand-written values, and the container refuses to start. The alternative —
  defaulting to the pipeline's answer LLM — would make ingestion compete with query serving
  and would silently produce an un-contextualised corpus if the endpoint were wrong; the
  endpoint is propagated from the `role: contextual_rag` model instead.
- **The caller owns `whole_document`.** Reconstructing the document by concatenating its
  chunks loses whatever the splitter dropped and double-counts chunk overlap; EDP already has
  the compressed text, so it sends it. The service still falls back to joining the chunks, but
  logs a warning that blurb quality is reduced.
- **Prefix caching is a first-class concern.** Document-first prompt ordering, per-document
  fitting, first-chunk warm-up and document-sticky routing are all in service of one thing:
  the document's KV cache is computed once per document instead of once per chunk. Without it,
  one LLM call per chunk is not affordable.
- **Hybrid search degrades, it does not fail.** A BM25 failure, a missing index, or a query
  that is entirely stopwords falls back to dense-only. A non-Redis vector store disables the
  query half at pre-install time and keeps the ingest half. Only a dense-leg failure is a real
  failure.
- **Follow the `late_chunking` precedent.** Every registration point that the existing optional
  EDP module touches — `images.yaml`, `tox.ini`, the CI matrix, chart helpers/configmap/values,
  Ansible defaults, pre-install checks, pipeline config, docs — has a contextual-RAG
  counterpart, and nothing else was invented.

## 10. Behaviour when the feature is disabled

With `edp_contextual_rag_enabled: false` (the default):

- No `contextualRag` block is rendered into the EDP chart, so the Deployment, Service, HPA and
  ConfigMap are not created (each template is wrapped in `if .Values.contextualRag.enabled`),
  and no image needs to exist in the registry.
- `CONTEXTUAL_RAG_ENABLED` is `"false"` and `CONTEXTUAL_RAG_ENDPOINT` is `""`, so the step 4.6
  block in `tasks.py` is skipped on both conditions and the ingest pipeline is byte-for-byte
  the previous one.
- `HYBRID_SEARCH_ENABLED` is not rendered, so the retriever's default (`False`) applies,
  `apply_hybrid_search_defaults()` returns immediately, and `search_type "similarity"` reaches
  the vector store unchanged.
- The new `EmbedDoc` / `RetrievalRequest` / `RetrieverParams` fields carry defaults and are
  only read on the `"hybrid"` path.
- `_filter_top_n_by_vector_distance()` sees no `rrf_score` and behaves exactly as before.
- No `app_pre_install` check fires, and the pre-install summary prints
  `Contextual RAG: false`.

The only unconditional behaviour changes are: `TEXT_PROCESSING_TIMEOUT_SECONDS` is now supplied
explicitly by the chart (with the same `300` default the code already used), `"vector"` is
accepted as an alias of `"similarity"`, and the retriever's *debug* log line prints
`Score: n/a` instead of raising when a document has no `vector_distance`.

## 11. Tests and lint gates

```bash
# new suite (45 + 9 tests)
cd src && tox -e contextual_rag_unit_tests

# suites extended or touched by this change
cd src && tox -e vectorstores_unit_tests,retrievers_unit_tests,reranks_unit_tests,edp_unit_tests
```

The repository's other CI checks (ansible-lint, bandit, checkov, shellcheck, trivy) run on the
pull request.

Also verified during the integration:

- `helm template` renders the EDP chart with `contextualRag.enabled` both `false` and `true`,
  including the `required` failures when the endpoint or model name is empty.
- `compare_crag_settings.py` was smoke-tested end to end on synthetic reports and produced the
  expected failure-rate, McNemar and supplementary output.
- `python -m py_compile` on every touched Python file.

## 12. Deliberately not included

The source implementation this was ported from contains changes that are **not** part of
contextual RAG or do not apply to this repository's 3.0.0 architecture. They were left out on
purpose:

| Not ported | Why |
| ---------- | --- |
| `--llm_judge_model` argparse option in `eval_multihop.py` | Unrelated to contextual RAG — an independent evaluation-harness convenience |
| `USE_HIERARCHICAL_INDICES` handling | 3.0.0 has no hierarchical dataprep |
| EDP-side vLLM chart changes, `vllm-headless-service.yaml` | 3.0.0 serves models via model-manager/KServe in `llm-inference`; the headless Service the sticky routing needs is provided there, and the catalog entry in `deployment/models.yaml` replaces the in-chart server |
| `nri_balloons` / CPU-pinning changes | Not part of this feature; the installer forwards its own pinning policy to model-manager |
| `EVALUATION.md`, `Evaluation_CRAG.md`, `crag_ab_report_s500.md`, `crag_integration_details.md`, `REDEPLOY.md`, `XEON_DEPLOY_AND_ACCESS.md`, `chatRAG.md` | Source-repo working documents. Their content that matters here was folded into this file, `docs/accuracy_tuning_tips.md`, the component READMEs and the evaluation README instead of adding parallel top-level docs |
| A `hybrid` entry in the UI search-type dropdown | Left at the default: `"similarity"` is upgraded to `"hybrid"` automatically when the deployment enables it, so no UI change is needed to use the feature |

Also note: `docs/docker_images_list.md` intentionally has no `contextual-rag` row, matching the
existing `late-chunking` component, whose image is likewise not published to Docker Hub.

## 13. Troubleshooting

| Symptom | Cause / fix |
| ------- | ----------- |
| `app_pre_install` fails with "no blurb model endpoint could be resolved" | Declare the blurb model in `inference_models` with `role: contextual_rag` (or set `edp_contextual_rag_endpoint`) — see [4.1](#41-declare-the-blurb-model-and-set-the-flag). This is intentional, not a bug |
| Ingestion fails with a celery timeout | One LLM call per chunk: raise `edp_text_processing_timeout_seconds` (and `edp_contextual_rag_request_timeout` for very large documents) |
| `edp-contextual-rag` pod stuck in `Init` | The init container is waiting for `$VLLM_SERVER_ENDPOINT/v1/models`. Check the blurb model (`role: contextual_rag`) is deployed and its KServe Service is reachable from the `edp` namespace |
| Some documents' chunks have no `context_blurb` | Expected for documents larger than the budget: the contextual-rag log has `Contextual RAG skipped for document <id>: its blurb prompt needs N + M tokens, over the B-token budget`. Those documents are indexed unchanged, never truncated. Raise `edp_contextual_rag_max_prompt_tokens` only up to the blurb model's served window (16384 for `qwen3-4b-w8a8-blurb`), or raise that window with it |
| Blurbs are generated but very slowly | Prefix caching is not being hit. Confirm the model was started with `--enable-prefix-caching`, that `CONTEXT_STICKY_ROUTING=true`, and that the headless Service exists (`CONTEXT_VLLM_REPLICA_HOST`). The log line `Contextualized N chunk(s) … in Xs` is the metric to watch |
| Log says "Server rejected the prompt as too long" | `CONTEXT_MAX_PROMPT_TOKENS` disagrees with the served `max_model_len`. Leave it at `0` so the window is read from the server, or pin it to the real value |
| Log says "approximating whole_document from the chunks" | The caller sent no `whole_document`. Expected only for direct API callers; EDP always sends it |
| Hybrid search seems to have no effect | Check `Hybrid search fused …` in the retriever log. If `rrf_k` was raised to 60 with 0.8/0.2 weights the lexical leg is inert — see [3.2](#32-query-time-contextual-bm25--rank-fusion--reranking) |
| Retrieval returns HTTP 501 | `search_type: hybrid` on a non-Redis vector store. Hybrid search requires RediSearch |
| Evaluation shows no improvement between settings | Almost always a corpus problem: the corpus was uploaded as one concatenated file instead of per document, or the two runs indexed different document sets. Use `--ingest_docs` (per-document) plus `clean_corpus.py` and `enforce_corpus_parity.py` |

## 14. References

- [Anthropic — Introducing Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval)
- [Contextual RAG microservice README](src/comps/contextual_rag/README.md)
- [Retriever README — hybrid search](src/comps/retrievers/README.md#hybrid-search-contextual-bm25--contextual-embeddings)
- [VectorStore README — hybrid search](src/comps/vectorstores/README.md#hybrid-search-hybrid)
- [Reranking README — documents produced by hybrid search](src/comps/reranks/README.md#documents-produced-by-hybrid-search)
- [Model Configuration — Contextual RAG](docs/customize/models.md#contextual-rag)
- [RAG Evaluation Guide — A/B evaluation](src/tests/e2e/evals/evaluation/rag_eval/README.md#comparing-two-configurations-ab-evaluation)
- [Installing Enterprise RAG](docs/deploy/install_rag.md)
