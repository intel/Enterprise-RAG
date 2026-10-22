# Contextual RAG — revised implementation (second review revision)

This document is a review guide for the changes made since the revision last reviewed in
PR #247, before the code moved to this repository (*the previous revision* below). It lists
every file the revision touches, what changed in it and why, the evaluation behind the shipped defaults, and what a reviewer should check.
For the feature as a whole — architecture, flag reference, evaluation procedure, and the full
change inventory against `main` — see
[contextual_RAG_integration.md](contextual_RAG_integration.md).

Contents

1. [What the revision changes](#1-what-the-revision-changes)
2. [Behaviour before and after](#2-behaviour-before-and-after)
3. [Commits in this pull request](#3-commits-in-this-pull-request)
4. [Changes per file](#4-changes-per-file)
5. [Configuration changes](#5-configuration-changes)
6. [The fit-or-skip rule in detail](#6-the-fit-or-skip-rule-in-detail)
7. [How the shipped configuration was chosen](#7-how-the-shipped-configuration-was-chosen)
8. [Verification](#8-verification)
9. [Points for the reviewer](#9-points-for-the-reviewer)
10. [How to try it](#10-how-to-try-it)

---

## 1. What the revision changes

Three behaviour changes and two fixes:

1. **A dedicated blurb model whose endpoint is propagated, not typed in** *(addresses the
   review comment that the LLM endpoint must not be filled in by the user)*. The blurbs are
   written by `qwen3-4b-w8a8-blurb` (`RedHatAI/Qwen3-4B-Instruct-2507-quantized.w8a8`), a new
   `deployment/models.yaml` entry sized like the answer LLM `llama3-8b-awq` (cpu 32, memory
   24Gi, 1 replica, vLLM 0.24.0, the same engine args) and served with a 16384-token window.
   It is declared in `inference_models` with the new **`role: contextual_rag`**;
   `app_inference_models` deploys it next to the answer LLM and propagates its KServe Service
   and served name to EDP. The previous `qwen3-4b-blurb` entry (bf16, 32 CPU / 100Gi,
   262144-token window, endpoint typed into the inventory) is removed.
2. **`CONTEXT_MAX_PROMPT_TOKENS` is a tunable budget with a default of 16384**, instead of "the
   full served window".
3. **Length-constrained contextualisation: fit or skip, never truncate.** A document is
   contextualised only if, for *every* one of its chunks, the blurb request — the whole
   document + the whole chunk + the chat template + `max_new_tokens` — fits the budget. A
   document that does not fit is skipped as a whole and its chunks are indexed unchanged. No
   document is ever truncated (previously it was cut down to fit the window).
4. **Fix — the `app_edp` template rendered invalid YAML when contextual RAG was enabled**, so
   the EDP chart could not be installed with the feature on. This bug was already present in
   the previous revision.
5. **Fix — `uv.lock` did not match `pyproject.toml`** after the review-time version bump to
   `3.0.0`, which breaks `uv sync --locked` in the Dockerfile and in the unit-test tox job.

Other configurations were evaluated before settling on this one; they are summarised in the
PR description, and [§7](#7-how-the-shipped-configuration-was-chosen) gives the measurements
for the shipped configuration.

## 2. Behaviour before and after

| Aspect | Previous revision | This revision |
| --- | --- | --- |
| Blurb LLM | `qwen3-4b-blurb` = `Qwen/Qwen3-4B-Instruct-2507` (bf16), 32 CPU / 100Gi, 262144-token window, deployed by hand | `qwen3-4b-w8a8-blurb` = `RedHatAI/Qwen3-4B-Instruct-2507-quantized.w8a8`, sized like `llama3-8b-awq` (32 CPU / 24Gi), 16384-token window, deployed by `app_inference_models` |
| Endpoint / model name | `edp_contextual_rag_endpoint` / `_model_name` typed into the inventory (empty default, mandatory) | Propagated by `app_inference_models` from `role: contextual_rag` → `http://qwen3-4b-w8a8-blurb-kserve-workload-svc.llm-inference.svc:8000`, `qwen3-4b-w8a8-blurb`; inventory values still override |
| Enabling the feature | Deploy the blurb model, set endpoint, model name and flag | Declare the blurb model in `inference_models` and set `edp_contextual_rag_enabled: true` |
| `CONTEXT_MAX_PROMPT_TOKENS` default | `0` = whatever window the server serves (262144) | `16384`, capped at the served window; `0` still means the whole served window |
| Document longer than the window | Truncated head-first to fit (up to 4 measure-and-trim passes) | Not contextualised; chunks returned unchanged |
| Server rejects a prompt as too long | Document shrunk to 60% and retried, twice | Document skipped as a whole; never shortened |
| Fit check | Once per document, against the longest chunk (by characters) | Longest chunk first (one call rejects a large document); if it fits, every chunk is measured |
| `CONTEXT_MAX_DOC_CHARS` | Optional hard character cap (truncation) | Removed |
| `/tokenize` failure handling | Any failure switched `/tokenize` off for the life of the process | Switched off only if the endpoint is missing (404/405/501); a transient error estimates that one prompt |
| MultiHop-RAG corpus coverage | All documents contextualised (some truncated if over the window) | 606 of 607 documents whole, 98.9% of the chunks; the one that does not fit is indexed without blurbs |

## 3. Commits in this pull request

The feature is re-submitted on top of the current `main` of this repository, so this pull
request carries all of it, not only the revision; the commits are grouped by area and are all
DCO-signed:

| # | Title | Area |
| --- | --- | --- |
| 1 | `feat(contextual_rag): add the contextual RAG microservice` | `src/comps/contextual_rag/`, its unit tests and tox/CI job, the `ContextualRagInput` datatypes in `src/comps/cores/`, `deployment/images.yaml` |
| 2 | `feat(retrievers): add contextual BM25 hybrid search with weighted rank fusion` | `src/comps/vectorstores/`, `retrievers/`, `reranks/`, `system_fingerprint/` and their unit tests |
| 3 | `feat(edp): contextualise chunks during ingestion` | `src/edp/` |
| 4 | `feat(deployment): deploy contextual RAG with a dedicated W8A8 blurb model` | `deployment/` (chart, Ansible roles, model catalog, chatqna config) |
| 5 | `test(e2e): add contextual RAG evaluation tooling and results` | `src/tests/e2e/evals/`, the two evaluation reports |
| 6 | `docs: document contextual RAG` | `docs/customize/`, this guide, the integration guide |

At every commit the unit tests pass; from commit 4 on, the Ansible-rendered EDP values go
through `helm template` with contextual RAG enabled.

## 4. Changes per file

Line counts are `+added −removed` of the revision itself, relative to the previous revision; the adjustments made while moving it onto this repository's `main` are listed in [§4.9](#49-adjustments-for-this-repository).

### 4.1. Microservice — `src/comps/contextual_rag/`

#### `utils/erag_contextual_rag.py` — +148 −145

The core of the revision: truncation is replaced by a fit-or-skip check.

- **Constants.** Removed `DEFAULT_CONTEXT_WINDOW` (262144), `PROMPT_SAFETY_MARGIN` and
  `MAX_FIT_ATTEMPTS`. Added `DEFAULT_MAX_PROMPT_TOKENS = 16384`.
- **`__init__`.** `max_prompt_tokens` defaults to `DEFAULT_MAX_PROMPT_TOKENS`; the
  `max_doc_chars` parameter is removed. The served window is now read lazily into
  `_served_window` (cached; `None` until first read).
- **`_served_context_window()`** (renamed from `_context_window()`). Reads `max_model_len`
  from `/v1/models` once and caches it. Returns `0` when it cannot be read, instead of
  assuming a default window.
- **`_prompt_budget()`** *(new)*. `min(CONTEXT_MAX_PROMPT_TOKENS, served window)`; `0` means
  the whole served window; falls back to the default when neither is known. Logs a warning
  when the configured budget exceeds the served window.
- **`_count_tokens()`**. Raises `ContextLengthExceeded` when the server refuses to count a
  prompt because it is longer than its window (treated as "does not fit"). Turns
  `/tokenize` off for good only on 404/405/501 (endpoint missing); a timeout or 5xx
  estimates that one prompt and tries `/tokenize` again next time.
- **`_prompt_tokens()`**. Now takes the pre-formatted system message, so the document is
  formatted once per document rather than once per measurement.
- **`_fit_document()` removed → `_document_fits()`** *(new)*. Returns
  `(fits, largest prompt, budget)`. Measures the longest chunk first and rejects the document
  after that single call if it does not fit. Otherwise measures every other chunk
  concurrently, because a chunk with fewer characters can still tokenise longer. In estimate
  mode only the longest chunk is measured, since the estimate is proportional to characters.
  Raises `ValueError` if `max_new_tokens` leaves no room for a prompt.
- **`run()`**. Builds the system message once, runs `_document_fits()`, and on a misfit
  returns the input chunks unchanged (`TextDocList(docs=chunks)`) with an INFO log. If the
  server rejects a prompt during generation (`ContextLengthExceeded`), the document is
  skipped the same way — the old 60%-shrink-and-retry loop is gone. Success logging reports
  the largest prompt against the budget.

#### `erag_contextual_rag_microservice.py` — +10 −10

`CONTEXT_MAX_PROMPT_TOKENS` defaults to `"16384"` (was `"0"`); `CONTEXT_MAX_DOC_CHARS` is no
longer read or passed; the start-up comment describes the dedicated blurb model.

#### `impl/microservice/.env` — +22 −21

The endpoint section explains that the blurb model is reached through its own KServe
Service (not the AI gateway); the example URL is
`http://qwen3-4b-w8a8-blurb-kserve-workload-svc.llm-inference.svc:8000`.
`CONTEXT_MAX_PROMPT_TOKENS=16384` (was `0`) with the fit-or-skip rule; `CONTEXT_MAX_DOC_CHARS`
removed; the `CONTEXT_CHARS_PER_TOKEN` comment says the estimate errs towards skipping.

#### `impl/microservice/uv.lock` — +1 −1

The project entry's `version` goes from `2.3.0` to `3.0.0`, matching `pyproject.toml` after
the review-time bump. `uv lock --check` failed before this change; `uv lock` regenerates this
exact file, so it is the only change needed.

#### `README.md`, `impl/microservice/.dockerhub/overview.md` — +107 −77, +4 −2

- **"A dedicated blurb model writes the blurbs"**: the `role: contextual_rag` entry, how its
  endpoint is propagated, why the KServe Service and not the gateway.
- **"One request = one source document, contextualised whole or not at all"**: the
  four-step fit-or-skip rule and the MultiHop-RAG coverage.
- Output contract: skipped documents' chunks come back unchanged.
- Configuration table: new `CONTEXT_MAX_PROMPT_TOKENS` default; `CONTEXT_MAX_DOC_CHARS` removed.
- "Sizing the blurb model" → **"Choosing the budget"**: why 16384, the Qwen3-4B KV arithmetic
  (144 KiB per token, 2.25 GiB per 16384-token prefix), the cap at the served window.
- Provenance of the published A/B/C figures and the re-measured shipped configuration.

### 4.2. Unit tests — `src/tests/unit/contextual_rag/`

#### `test_erag_contextual_rag.py` — +223 −104 — 33 → 45 tests

Removed or replaced (13) — nine asserted truncation or the removed `_fit_document()` API:
`test_whole_document_is_sent_when_the_prompt_fits`,
`test_document_is_trimmed_only_when_the_prompt_exceeds_the_window`,
`test_max_doc_chars_caps_the_document_before_the_token_budget`,
`test_fitting_rejects_a_chunk_that_cannot_fit_on_its_own`,
`test_fitting_rejects_a_generation_budget_larger_than_the_window`,
`test_run_fits_the_document_against_the_longest_chunk`,
`test_run_shrinks_the_document_and_retries_when_the_server_rejects_the_prompt`,
`test_run_gives_up_when_the_prompt_still_does_not_fit`,
`test_configured_prompt_budget_wins_over_the_served_window`; four were renamed (the three
`test_context_window_*` tests → `test_served_window_*`, and
`test_prompt_length_falls_back_to_an_estimate_without_tokenize` →
`…_when_tokenize_is_not_served`).

Added (25):

| Area | Tests |
| --- | --- |
| Budget | `test_default_prompt_budget_is_16384_tokens`, `test_prompt_budget_is_capped_at_the_served_window`, `test_prompt_budget_below_the_served_window_is_kept`, `test_prompt_budget_zero_means_the_whole_served_window`, `test_prompt_budget_falls_back_to_the_default_when_nothing_is_known` |
| Served window | `test_served_window_is_read_from_the_model_card`, `…_uses_the_first_card_that_advertises_a_window`, `…_is_unknown_when_the_card_is_unreadable` |
| `/tokenize` | `test_prompt_length_falls_back_to_an_estimate_when_tokenize_is_not_served`, `test_a_transient_tokenize_failure_does_not_switch_tokenize_off`, `test_a_prompt_too_long_to_count_raises_context_length_exceeded` |
| Fit or skip | `test_a_document_fits_when_every_prompt_plus_the_blurb_fits_the_budget` (exact boundary: 900 + 100 = 1000 fits), `test_one_token_over_the_budget_does_not_fit`, `test_a_document_whose_longest_chunk_does_not_fit_is_rejected_after_one_count`, `test_every_chunk_is_checked_not_just_the_longest`, `test_with_an_estimate_only_the_longest_chunk_is_measured`, `test_a_document_the_server_refuses_to_count_does_not_fit`, `test_a_shorter_chunk_the_server_refuses_to_count_keeps_the_document_out`, `test_a_generation_budget_that_leaves_no_room_for_a_prompt_is_a_configuration_error` |
| `run()` | `test_run_always_sends_the_whole_document`, `test_run_checks_the_fit_with_the_whole_document_and_every_chunk`, `test_run_skips_a_document_that_does_not_fit` (chunks and metadata byte-identical, no LLM call), `test_run_skips_the_document_when_the_server_rejects_a_prompt` (one attempt, no shortened retry) |
| End to end (fake server, nothing patched) | `test_run_end_to_end_against_a_fake_server`, `test_run_end_to_end_skips_an_oversized_document_with_one_count` |

Existing routing, retry, warm-up and prepend tests are kept, switched to patch
`_document_fits` instead of `_prompt_tokens` / `_fit_document`. The model name in the tests is
`qwen3-4b-w8a8-blurb`.

#### `test_erag_contextual_rag_microservice.py` — +8 −7 — 8 → 9 tests

Model name `qwen3-4b-w8a8-blurb`; new `test_prompt_budget_defaults_to_16384_tokens`; the
environment-wiring test sets `CONTEXT_MAX_PROMPT_TOKENS=4096` and no longer sets
`CONTEXT_MAX_DOC_CHARS`.

### 4.3. Helm chart — `deployment/components/edp/`

#### `templates/contextualRag/contextual-rag-configmap.yaml` — +16 −13

- The comment and both `required` messages now say "declare the blurb model in
  `inference_models` with `role: contextual_rag`, or set `edp_contextual_rag_endpoint`"
  (they previously referred to 2.3.0-style `edp.contextual_rag.*` keys).
- `CONTEXT_MAX_DOC_CHARS` removed. `CONTEXT_MAX_PROMPT_TOKENS` is rendered with
  `hasKey … | ternary … "16384"` instead of `| default`, because Sprig's `default` treats an
  integer `0` as empty and would silently turn "whole served window" into the default.

#### `values.yaml` — +19 −15

The `contextualRag.config` comment describes the dedicated blurb model and where the
propagated values come from; `max_prompt_tokens: "16384"` (was `"0"`) with the fit-or-skip
rule; `max_doc_chars` removed; `chars_per_token` comment updated.

### 4.4. Ansible roles — `deployment/roles/`

#### `app_inference_models/tasks/install.yaml` — +76 −11

A fourth model role, `contextual_rag`, alongside `llm`, `embedding` and `reranking`:

- **Validation.** Every declared role must be in `inference_known_roles`, and at most one
  model may be declared per role and per name (a repeated role would export only the last
  entry's endpoint).
- **Sizing.** Both `_deploy_overrides` branches size `contextual_rag` from its catalog entry
  (or `inference_default_contextual_rag_*`). Under auto-size it is still taken verbatim:
  `calculate_replicas.py` sizes one vLLM, and feeding the blurb model through `--vllm-size`
  would resize the answer LLM instead. The sizing summary says so.
- **Best-effort CPU pinning.** The NUMA-0 core check counts the blurb model's cores, and its
  failure message names it; the blurb model binds to the core window after embedding.
- **Endpoint.** It resolves to the model's own KServe Service, like embedding and reranking,
  not the AI gateway: the blurb service reads the served `max_model_len` from `/v1/models`,
  counts prompts with `/tokenize`, and pins all chunks of a document to one replica for
  prefix-cache reuse — the gateway gives none of the three. "Set endpoint vars" exports
  `contextual_rag_endpoint` / `contextual_rag_model_name` from it; both are empty when the
  role is not declared.

#### `app_inference_models/defaults/main.yaml` — +34 −1

Documents the roles, adds `inference_known_roles: [llm, embedding, reranking, contextual_rag]`
and `inference_default_contextual_rag_cpu: 32` / `_memory: "24Gi"` / `_replicas: 1`.

#### `app_pre_install/tasks/solution_config.yaml` — +32 −16

The two hard failures check both the inventory value and the propagated fact, and point at
`role: contextual_rag`:

- *"Require a blurb model for contextual RAG"* — fails when `edp_contextual_rag_enabled` is
  true and neither `edp_contextual_rag_endpoint` nor `contextual_rag_endpoint` resolves. The
  message shows the `- name: qwen3-4b-w8a8-blurb / role: contextual_rag` entry and the Service
  URL it would propagate.
- *"Require a blurb model name for contextual RAG"* — only reachable with an endpoint set by
  hand and no model name.

The non-Redis hybrid-search auto-disable task is unchanged.

#### `app_pre_install/defaults/main.yaml` — +6, `app_pre_install/tasks/load_settings.yaml` — +2 −1

`contextual_rag_endpoint` / `contextual_rag_model_name` as empty cross-role defaults, so the
role renders standalone. The pre-install summary shows *"Contextual RAG Blurb LLM: <name>
(<endpoint>)"* and *"Contextual RAG Prompt Budget: N tokens (larger documents are indexed
without blurbs)"*.

#### `app_edp/defaults/main.yaml` — +37 −17

`edp_contextual_rag_endpoint` / `_model_name` default to `{{ contextual_rag_endpoint }}` /
`{{ contextual_rag_model_name }}` (were `""` and mandatory), with the inventory override
documented as the escape hatch for an endpoint this solution does not deploy.
`edp_contextual_rag_max_prompt_tokens: 16384` (was `0`) with the rule and the MultiHop-RAG
coverage; `edp_contextual_rag_max_doc_chars` removed.

#### `app_edp/templates/values.yaml.j2` — +9 −9

- **Bug fix**: two `{#- … #}` comments changed to `{# … #}`. Ansible renders with
  `trim_blocks`, which drops the newline after a comment; the leading `-` also stripped the
  newline before it, so two keys were joined on one line
  (`max_concurrency: "32"    max_prompt_tokens: "0"`) and `helm` rejected the values with
  *"did not find expected key"*. This affected the previous revision whenever contextual RAG was enabled.
- `max_prompt_tokens` defaults to `'16384'`; the `max_doc_chars` line is removed.

### 4.5. Model catalog and pipeline config

#### `deployment/models.yaml` — +24 −28

`qwen3-4b-blurb` (`Qwen/Qwen3-4B-Instruct-2507` bf16, 32 CPU / 100Gi,
`VLLM_CPU_KVCACHE_SPACE: 40`, `--max-model-len 262144`) is replaced by `qwen3-4b-w8a8-blurb`
(`RedHatAI/Qwen3-4B-Instruct-2507-quantized.w8a8`). It is identical to `llama3-8b-awq` except
for `model_id` and `--max-model-len 16384`. W8A8 (int8 weights and activations) is the 8-bit
format vLLM's CPU backend runs; 8-bit GPTQ checkpoints do not load on CPU.

#### `deployment/pipelines/chatqna/config.yaml` — +13 −7

A commented-out `- name: qwen3-4b-w8a8-blurb / role: contextual_rag` entry under
`inference_models`, ready to enable with the flag. The hand-filled endpoint lines are removed;
the block explains that the dedicated model writes the blurbs and that larger documents are
indexed without blurbs, and adds a commented `edp_contextual_rag_max_prompt_tokens: 16384` knob.

### 4.6. Evaluation tooling — `src/tests/e2e/evals/evaluation/rag_eval/examples/`

`contextualization_stats.py` (+24 −5) and `verify_blurb_coverage.py` (+27 −7) parse the new
`Contextualized …` / `Contextual RAG skipped for document …` log lines, so skipped documents
are counted as skipped rather than as missing blurbs.

### 4.7. Other

`src/comps/retrievers/impl/microservice/.env` (+1 −1): a comment still named the 2.3.0-style
key `edp.contextual_rag.enabled`; it now says `edp_contextual_rag_enabled`.

### 4.8. Documentation

| File | Change |
| --- | --- |
| [contextual_RAG_integration.md](contextual_RAG_integration.md) | Architecture diagram and service properties (dedicated blurb model, fit-or-skip, skip on rejection); §2 adds the re-measured shipped configuration; flag-propagation map; "4.1 Declare the blurb model and set the flag"; flag reference (`max_prompt_tokens` 16384, `max_doc_chars` removed); validation, deployment and troubleshooting; §8 change inventory regenerated against `main` |
| [docs/customize/models.md](docs/customize/models.md#contextual-rag), [docs/customize/configuration.md](docs/customize/configuration.md) | The previous revision's "Contextual RAG" section of `docs/accuracy_tuning_tips.md`, which no longer exists in this repository, moved to "Accuracy tuning → Contextual RAG" in `models.md`: enablement with the dedicated blurb model, the fit-or-skip budget, drawbacks, the re-measured figures. `configuration.md` gains the `contextual_rag` role and the two main flags |
| [contextual_RAG_evaluation_200q.md](contextual_RAG_evaluation_200q.md) | Provenance note: measured with the bf16 blurb server over every document; points at the re-run |
| [contextual_RAG_evaluation_200q_Qwen_C_new_variant1.md](contextual_RAG_evaluation_200q_Qwen_C_new_variant1.md) | New: the 200-query evaluation of the shipped configuration ([§7](#7-how-the-shipped-configuration-was-chosen)) |
| `Contextual_RAG_new_implementaion.md` | This guide |

### 4.9. Adjustments for this repository

The code was re-applied on the current `main` of this repository. Apart from one textual
merge (the argument table in `src/tests/e2e/evals/evaluation/rag_eval/README.md`, which
now keeps `main`'s embedding endpoint and `--embedding_model_name` row and adds the three
`--ingest_*` rows), the following were changed to fit it:

- **Image name.** `erag-contextual-rag` → `enterprise-rag-contextual-rag`, and the chart's
  default `repository` `docker.io/opea` → `docker.io/intel`, matching the other images.
- **Documentation location.** `docs/accuracy_tuning_tips.md` does not exist here; its
  Contextual RAG section moved to `docs/customize/models.md#contextual-rag`, and
  `docs/customize/configuration.md` gains the role and flags. Install steps refer to
  `./es_auto_installer.sh install erag --env <name>` and `env/<name>/config.erag.yaml`, and
  examples use this repository's default reranker `bge-reranker-v2-m3`.
- **Replica calculator.** `main` reserves memory per role (`--*-memory-gib`) and counts one
  router per `inference_models` entry. The blurb model is counted as a router automatically,
  but, like its cores, its memory is outside the calculator's reservation; the comments say so.
- **Public-repository hygiene.** Local lab paths and pod IPs in the evaluation artefacts and
  one docstring example were replaced with placeholders; a link to a report that was never
  part of the change was replaced with a link to the integration guide.

## 5. Configuration changes

| Setting (Ansible → env) | Before | After |
| --- | --- | --- |
| `inference_models` | — | New `role: contextual_rag` entry, `qwen3-4b-w8a8-blurb` |
| `edp_contextual_rag_endpoint` → `VLLM_SERVER_ENDPOINT` | `""`, mandatory, typed in | `{{ contextual_rag_endpoint }}` — the blurb model's KServe Service, propagated |
| `edp_contextual_rag_model_name` → `CONTEXT_MODEL_NAME` | `""`, mandatory, typed in | `{{ contextual_rag_model_name }}` — the blurb model's served name, propagated |
| `edp_contextual_rag_max_prompt_tokens` → `CONTEXT_MAX_PROMPT_TOKENS` | `0` (whole served window) | `16384`, capped at the served window; `0` = whole served window |
| `edp_contextual_rag_max_doc_chars` → `CONTEXT_MAX_DOC_CHARS` | `0` (disabled) | **Removed** — it was a truncation knob. An inventory still setting it is ignored |
| `edp_contextual_rag_max_new_tokens` → `MAX_NEW_TOKENS` | `100` | `100` (unchanged; counted against the budget) |
| `edp_contextual_rag_max_concurrency` → `CONTEXT_MAX_CONCURRENCY` | `32` | `32` (unchanged) |

New Ansible variables: `inference_known_roles`, `inference_default_contextual_rag_{cpu,memory,replicas}`;
new facts exported by `app_inference_models`: `contextual_rag_endpoint`, `contextual_rag_model_name`.

## 6. The fit-or-skip rule in detail

For a document with chunks *c₁…cₙ*:

```
budget = min(CONTEXT_MAX_PROMPT_TOKENS, served max_model_len)      # 0 → served window
prompt(cᵢ) = /tokenize( system: "<document>\n{whole document}\n</document>",
                        user:   Anthropic's chunk template with cᵢ,
                        add_generation_prompt = true )
contextualise the document  ⇔  max over i of prompt(cᵢ) + MAX_NEW_TOKENS ≤ budget
```

- The prompt is counted from exactly the messages the generation request sends, so the count
  is what the server will see. There is no safety margin; vLLM itself enforces
  `prompt + max_tokens ≤ max_model_len` as a backstop.
- The decision is per document, never per chunk: either every chunk gets a blurb against the
  whole document, or none does.
- Cost for an oversized document is one `/tokenize` call of the whole document (measured: 0.1 s
  for a 200-chunk document, 2.4 s for a 2 MB one, 9–10 s for the 8 MB files of
  `prepare_1M_vectors.sh`).

Coverage of the MultiHop-RAG corpus (512/64 chunking, `MAX_NEW_TOKENS=100`), measured at
ingest with `qwen3-4b-w8a8-blurb`'s `/tokenize` at the default budget of 16384: **606 of 607
documents** are contextualised and **17,389 of 17,589 chunks (98.9%)** get a blurb. At 8192,
about a dozen of the largest documents — roughly 10% of the chunks — would be indexed without
blurbs, which is why the default is 16384.

## 7. How the shipped configuration was chosen

The shipped configuration was measured on 200 sampled MultiHop-RAG queries (607-document
corpus), on one deployment, against a re-measured baseline and the implementation as first
submitted (whole document, dedicated bf16 Qwen3-4B server), all in setting C (dense +
contextual BM25, weighted RRF, reranking) with `llama3-8b-awq` answering and the same harness
and RAGAS judge:

| Configuration | Blurb LLM, budget | Hits@10 | MRR@10 | Answer correctness | Mean TTFT | Full ingest | Isolated upload, added per doc | Largest corpus doc alone |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A — baseline | — | 0.785 | 0.572 | 0.592 | 2.10 s | 0.69 h | — | 7.8 s |
| As first submitted | dedicated Qwen3-4B bf16, whole document | 0.825 | 0.614 | 0.637 | 2.46 s | 1.80 h | +41.0 s | 201.9 s |
| **Shipped** | **dedicated Qwen3-4B W8A8, 16384** | **0.805** | **0.606** | **0.597** | **2.43 s** | **1.19 h** | **+21.4 s** | **9.3 s** |

- **Level with whole-document contextualisation** — paired MRR@10 −0.009 [−0.039, +0.022],
  answer correctness −0.027 [−0.061, +0.006], Hits@10 4 queries fixed / 8 broken, p = 0.39 —
  at two thirds of its ingest time, and with a bounded cost for large documents.
- **Against the baseline** it is ahead on every accuracy measure (Hits@10 16 queries fixed /
  12 broken, MRR@10 +0.034 [−0.011, +0.079], answer correctness +0.005), but none of these is
  statistically significant at n = 200. This baseline is stronger than in September (Hits@10
  0.785 vs 0.690) because the deployment now hands the reranker 30 candidates per query in
  every setting; the whole-document implementation reproduced its own September result
  (0.825 vs 0.835).
- **Ingestion at scale.** A 2 MB document is over the budget, so it is skipped and costs 1.4 s
  (the fit check) over the baseline's 47.2 s, rather than the 217 s reported for whole-document
  contextualisation. On `prepare_1M_vectors.sh`, an ingested 8 MB file took 268 s against the
  baseline's 262 s. Where blurbs are written the cost is real: mid-sized documents (150–700 KB
  PDFs and HTML) took about 2.8× longer to become searchable.

Full report: [contextual_RAG_evaluation_200q_Qwen_C_new_variant1.md](contextual_RAG_evaluation_200q_Qwen_C_new_variant1.md);
raw artefacts under
`src/tests/e2e/evals/evaluation/rag_eval/examples/results/multihop_200q_qwen_c_new_variant1/`.

## 8. Verification

| Check | Result |
| --- | --- |
| Unit tests on this repository's `main` (`tox -e contextual_rag_unit_tests,vectorstores_unit_tests,retrievers_unit_tests,reranks_unit_tests,edp_unit_tests`) | All five suites pass (contextual RAG: 54 tests) |
| Each commit on its own (`git archive` of every commit) | Unit tests pass at every commit; the Ansible → Helm render passes from commit 4 on |
| `ansible-lint==26.8.0` with the workflow's arguments | 0 failures, 0 warnings, as on `main` |
| `bandit==1.9.4` with the workflow's arguments (soft-fail) | One finding more than on `main`: B104 for `host='0.0.0.0'` in the new microservice, the pattern every other microservice uses |
| `helm template` of the EDP chart | Defaults render `CONTEXT_MAX_PROMPT_TOKENS: "16384"`; integer `0` stays `"0"`; a missing endpoint fails with the `role: contextual_rag` `required` message; no contextual-rag objects when the flag is off |
| The real `app_inference_models` and `app_pre_install` task bodies, extracted and run under Ansible against mocked inputs and the real `deployment/models.yaml` | Role validation accepts the four roles and rejects an unknown or repeated one; with `role: contextual_rag` the blurb model's Service is exported while `llm_endpoint` stays the gateway; without it both facts are empty (no fallback to the answer LLM); the blurb model is sized 32 CPU / 24Gi like `llama3-8b-awq` and binds to cores 40–71 after llm/reranking/embedding; a 48-core NUMA node fails the core check naming `blurb=32`; both pre-install failures fire exactly when expected |
| `app_edp/templates/values.yaml.j2` rendered by Ansible and fed to `helm template` | Previous revision: fails (*did not find expected key*). This revision: renders the blurb model's endpoint, name and the 16384 budget into the ConfigMap |
| `uv lock --check` | Fails at the previous revision; passes here |
| Live end to end ([§7](#7-how-the-shipped-configuration-was-chosen)) | The fit-or-skip service of this revision (the image the runs used differs from this code only in comments and the default budget, which the runs set to 16384 explicitly) ran the evaluation and benchmark above against vLLM serving `RedHatAI/Qwen3-4B-Instruct-2507-quantized.w8a8` with a 16384-token window |

## 9. Points for the reviewer

- **The 3.0.0 deployment wiring was verified by rendering, not by a live deployment.** The
  evaluations ran on an ERAG 2.3.0 lab cluster with this branch's contextual-rag service and
  EDP changes ported in, and the blurb model deployed as a StatefulSet by hand; the
  `role: contextual_rag` path through `model-manager` was checked with the real Ansible task
  bodies and `helm template` ([§8](#8-verification)), not end to end.
- **The blurb model needs its own resources.** The catalog entry is sized like
  `llama3-8b-awq` (32 CPU / 24Gi, 1 replica), outside the replica calculator's NUMA fit and
  its per-role memory reservation (`--*-memory-gib`), so on a node sized tightly for the
  query path the calculator does not leave room for it; the best-effort core check fails the
  deployment if the node lacks the cores. The evaluation ran
  it as 2 replicas × 24 CPUs (each like one answer-LLM pod there) with 10 GiB of KV cache; the
  catalog entry, like `llama3-8b-awq`'s, does not set `VLLM_CPU_KVCACHE_SPACE`, so vLLM sizes
  the KV cache itself; one full 16384-token document prefix needs 2.25 GiB of it. Scale
  `replicas` for ingest-heavy deployments.
- **The gain over the baseline is not significant at n = 200**, see [§7](#7-how-the-shipped-configuration-was-chosen).
  The 500-query A/B/C figures in the READMEs were measured with the bf16 blurb server over
  every document and are labelled as such.
- **Documents over the budget get no blurbs.** That is 1 of 607 MultiHop-RAG documents, but
  all of `prepare_1M_vectors.sh`'s 8 MB Wikipedia files. The budget can be raised together
  with the model's `--max-model-len` (Qwen3-4B-Instruct-2507 supports 262144 natively) at a
  per-blurb cost that grows with document length.
- **Not changed in this revision:** with more than one blurb-model replica, document-sticky
  routing derives `<endpoint host>-headless` from a fully qualified Service name, which does
  not resolve, so it falls back to the ClusterIP Service and prefix-cache reuse across
  replicas is not guaranteed. The shipped single replica is unaffected.

## 10. How to try it

Unit tests, as CI runs them:

```bash
cd src
tox -e contextual_rag_unit_tests
```

Enable the feature in the pipeline configuration (e.g.
[deployment/pipelines/chatqna/config.yaml](deployment/pipelines/chatqna/config.yaml)) — no
endpoint or model name to add:

```yaml
inference_models:
  - name: llama3-8b-awq
    role: llm
  - name: qwen3-4b-w8a8-blurb
    role: contextual_rag
  # ... embedding / reranking entries

edp_contextual_rag_enabled: true
# edp_contextual_rag_max_prompt_tokens: 16384  # optional; documents that do not fit get no blurbs
```

After ingesting, the contextual-rag log shows one line per document, either
`Contextualized N chunk(s) of document <id> … (whole document in prompt, largest prompt P + 100 of 16384 tokens)`
or
`Contextual RAG skipped for document <id>: its blurb prompt needs P + 100 tokens, over the 16384-token budget … not truncated`.
