# Contextual RAG evaluation — MultiHop-RAG, 200 sampled queries — Qwen C_new, variant-1

The configuration this PR ships, measured on 2026-10-20/21 on the same deployment, corpus, 200 queries,
harness and judge as the earlier comparison runs (Llama and Qwen rows below; those runs' reports are not part
of this PR). The contextual-rag service is the NEW implementation of this revision (fit-or-skip, never
truncate); the setting is C (dense + contextual BM25,
weighted RRF, reranking).

| | Qwen C_new | **Variant-1** | Llama C_new | Llama C_old |
|---|---|---|---|---|
| Answer LLM | `RedHatAI/Qwen3-4B-Instruct-2507-quantized.w8a8` | `casperhansen/llama-3-8b-instruct-awq` | `casperhansen/llama-3-8b-instruct-awq` | `casperhansen/llama-3-8b-instruct-awq` |
| Blurb LLM | the answer LLM | **a separate `RedHatAI/Qwen3-4B-Instruct-2507-quantized.w8a8` deployment** | the answer LLM | a dedicated `Qwen/Qwen3-4B-Instruct-2507` (bf16) server |
| Blurb LLM resources | shares 4 × 24 CPUs with answering | 2 replicas, each like an answer-LLM pod: 24 CPUs, 26 Gi / 52 Gi, 10 GiB KV | shares 4 × 24 CPUs with answering | 1 server, 31 CPUs, 24 GiB KV |
| Token budget per blurb request (prompt + `MAX_NEW_TOKENS` = 100) | 8192 | **16384** | 8192 | whole window (65,536) |
| Implementation | NEW (fit-or-skip) | NEW (fit-or-skip) | NEW (fit-or-skip) | OLD (whole document) |

A document is contextualised only if, for every one of its chunks, the blurb prompt plus the
`MAX_NEW_TOKENS` = 100 blurb tokens fits `CONTEXT_MAX_PROMPT_TOKENS`; larger documents are indexed
without blurbs, never truncated. With 16384 a prompt may be up to 16,284 tokens.

**Headline.** Variant-1 scores Hits@10 **0.805**, MRR@10 **0.606** and answer correctness **0.597**
(Llama C_old 0.825 / 0.614 / 0.637; Llama C_new 0.805 / 0.561 / 0.581).
Against Llama C_old, ranking is statistically level and answer correctness statistically level;
against Llama C_new, ranking is better and answer correctness statistically level.
The 16384 budget contextualises 606 of 607 documents (1 skipped, against 12–13 at 8192).
Cost: the full corpus ingests in **1.19 h** (Llama C_new 1.40 h, Llama C_old 1.80 h);
an isolated upload costs **+21.4 s** per document over the baseline; mean TTFT 2.43 s (Llama A 2.10 s).

---

## 1. The full picture: every configuration measured

Llama and Qwen rows are from the two earlier reports; B and C of one implementation share an ingest,
so their ingestion columns are the same. Best value per column in bold (highest for quality, lowest
for cost). Hits@10 differences between the leading rows are not significant (§2).

| Configuration | Answer LLM | Blurb LLM | Budget | Hits@10 | MRR@10 | Answer correctness | Faithfulness | Mean TTFT (s) | Full ingest (h) | Isolated: added / doc (s) | Largest doc alone (s) | Docs skipped | Second model |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Llama A | Llama-3-8B AWQ | — | — | 0.785 | 0.572 | 0.592 | **0.666** | 2.10 | **0.69** | — | **7.8** | — | — |
| Llama B_new | Llama-3-8B AWQ | Llama-3-8B AWQ (answer LLM) | 8192 | 0.800 | 0.547 | 0.588 | 0.658 | 1.98 | 1.40 | 13.7 | 10.3 | 12 | no |
| Llama C_new | Llama-3-8B AWQ | Llama-3-8B AWQ (answer LLM) | 8192 | 0.805 | 0.561 | 0.581 | 0.642 | 2.23 | 1.40 | 13.7 | 10.3 | 12 | no |
| Llama B_old | Llama-3-8B AWQ | Qwen3-4B bf16 (dedicated) | whole window | 0.820 | 0.608 | 0.631 | 0.649 | 2.42 | 1.80 | 41.0 | 201.9 | 0 | yes |
| Llama C_old | Llama-3-8B AWQ | Qwen3-4B bf16 (dedicated) | whole window | 0.825 | 0.614 | **0.637** | 0.645 | 2.46 | 1.80 | 41.0 | 201.9 | 0 | yes |
| Qwen A | Qwen3-4B W8A8 | — | — | 0.785 | 0.572 | 0.530 | 0.604 | **1.38** | 0.71 | — | 11.2 | — | — |
| Qwen B_new | Qwen3-4B W8A8 | Qwen3-4B W8A8 (answer LLM) | 8192 | 0.805 | 0.572 | 0.541 | 0.586 | 1.66 | 0.92 | **8.7** | 8.4 | 13 | no |
| Qwen C_new | Qwen3-4B W8A8 | Qwen3-4B W8A8 (answer LLM) | 8192 | **0.830** | 0.579 | 0.529 | 0.591 | 1.70 | 0.92 | **8.7** | 8.4 | 13 | no |
| Qwen B_old | Qwen3-4B W8A8 | Qwen3-4B W8A8 (dedicated) | whole window | 0.800 | 0.620 | 0.538 | 0.608 | 1.67 | 1.43 | 33.3 | 173.9 | 0 | yes |
| Qwen C_old | Qwen3-4B W8A8 | Qwen3-4B W8A8 (dedicated) | whole window | 0.820 | **0.632** | 0.550 | 0.623 | 1.73 | 1.43 | 33.3 | 173.9 | 0 | yes |
| **Variant-1 C_new** | Llama-3-8B AWQ | Qwen3-4B W8A8 (separate, 2 x 24 CPUs) | 16384 | 0.805 | 0.606 | 0.597 | 0.634 | 2.43 | 1.19 | 21.4 | 9.3 | 1 | yes |

---

## 2. Variant-1 against the closest configurations, paired over the 200 queries

Hits@10: exact McNemar (`fixed` / `broken` = queries variant-1 gets right and the other misses / the
reverse). MRR@10 and answer correctness: mean difference (variant-1 minus the other) with a 95 % paired-
bootstrap interval; bold where the interval excludes zero. Answer correctness is compared over the
queries both scorings scored.

| Variant-1 vs | Hits@10 fixed / broken, p | MRR@10 difference | Answer-correctness difference |
|---|---|---|---|
| Llama A (baseline, same answer LLM) | 16 / 12, 0.57 | +0.034 [−0.011, +0.079] | — (no per-query scores for the Llama baseline) |
| Llama C_new (same answer LLM, Llama blurbs at 8192) | 9 / 9, 1.00 | **+0.045** [+0.005, +0.086] | +0.013 [−0.024, +0.051] |
| Llama C_old (same answer LLM, dedicated Qwen bf16 blurbs, whole window) | 4 / 8, 0.39 | −0.009 [−0.039, +0.022] | −0.027 [−0.061, +0.006] |
| Qwen C_new (same blurb model at 8192, Qwen answering) | 8 / 13, 0.38 | +0.027 [−0.011, +0.065] | **+0.067** [+0.026, +0.106] |
| Qwen C_old (dedicated Qwen W8A8 blurbs, Qwen answering) | 4 / 7, 0.55 | −0.026 [−0.061, +0.009] | **+0.057** [+0.021, +0.093] |

Against **Llama C_new** — the same answer LLM and code, with Llama's own blurbs at 8192 — variant-1's ranking is better and its answers are not distinguishable.
Against **Llama C_old** — the same answer LLM with whole-document Qwen blurbs from a dedicated server — ranking is not distinguishable and answers are not distinguishable.
Against the **Llama baseline**, ranking is not distinguishable.

---

## 3. What the 16384 budget changes

| | Variant-1 (16384) | Qwen C_new (8192) | Llama C_new (8192) |
|---|---|---|---|
| documents contextualised / skipped | 606 / 1 | 594 / 13 | 595 / 12 |
| chunks with a blurb | 17,389 / 17,589 (98.9 %) | 15,669 | 15,767 |
| longest prompt sent (tokens) | 15,805 | 8,054 | 8,017 |
| avg. blurb length (chars) | 267 | 271 | 103 |
| documents truncated | 0 | 0 | 0 |

Skipped under variant-1: `520_78-absolute-best-october-prime-day-d…`. 0 of the 200 queries cite a skipped document.

---

## 4. Contextualisation and ingestion cost

| | Variant-1 | Qwen C_new | Llama C_new |
|---|---|---|---|
| blurb service time per contextualised chunk (full ingest) | **1.13 s** | 0.91 s | 1.59 s |
| blurb-stage aggregate service time | 5.45 h | 3.94 h | 6.97 h |
| full-corpus ingest wall clock | **1.19 h** | 0.92 h | 1.40 h |
| in corpus: end to end per document (mean) | 41.5 s | 31.5 s | 48.8 s |
| in corpus: end to end per chunk | 1.431 s | 1.087 s | 1.684 s |
| in corpus: blurb time per chunk, all chunks | 1.117 s | 0.807 s | 1.427 s |
| in corpus: blurb time per document, all documents | 32.4 s | 23.4 s | 41.4 s |
| in corpus: largest document (`520_…`, 69.5 KB) end to end / blurbs | 4.7 / 0.0 s (skipped) | 6.2 / 0.0 s (skipped) | 8.3 / 0.0 s (skipped) |

Isolated ingests, the same 21 documents one at a time on a quiet host; A was re-measured in the same session:

| Metric | A (this session) | Variant-1 C | Qwen C_new | Llama C_new |
|---|---|---|---|---|
| **1.** end to end per document (mean / median) | 6.14 / 6.09 s | **27.58** / 15.24 s | 14.65 / 14.50 s | 19.44 / 16.89 s |
| **1.** end to end per chunk | 0.113 s | **0.507 s** | 0.269 s | 0.357 s |
| … added over A, per document | — | **+21.45 s** | +8.69 s | +13.67 s |
| **2.** blurb time per chunk, all chunks | — | **0.371 s** | 0.138 s | 0.238 s |
| **2.** blurb time per document, all documents | — | **20.20 s** | 7.48 s | 12.97 s |
| sampled documents skipped | — | 1 | 4 | 3 |
| **3.** largest document (`520_…`, 69.5 KB, 200 chunks) end to end | 8.0 s | **9.3 s** (skipped) | 8.4 s (skipped) | 10.3 s (skipped) |
| **4.** … its blurb time | — | **0.0 s** | 0 s | 0 s |
| `576_54-best-apple-black-friday-deals…` end to end / blurbs | 6.7 s | 47.2 / 36.4 s | 5.8 / 0.0 s (skipped) | 49.0 / 41.6 s |
| `213_the-best-video-games-of-the-year…` end to end / blurbs | 7.4 s | 137.2 / 124.6 s | 10.4 / 0.0 s (skipped) | 7.9 / 0.0 s (skipped) |

---

## 5. Serving latency per query

Same streaming probe over the 200 queries, with the judges idle.

| | Variant-1 C | Llama A | Llama C_new | Llama C_old | Qwen C_new |
|---|---|---|---|---|---|
| avg. TTFT (s) | 2.433 | 2.105 | 2.231 | 2.461 | 1.700 |
| p90 TTFT (s) | 2.687 | 2.377 | 2.505 | 2.737 | 1.878 |
| avg. next-token time (ms) | 46.4 | 51.0 | 47.0 | 47.1 | 37.6 |
| avg. generated tokens | 117.0 | 114.8 | 120.7 | 113.5 | 148.1 |
| queries succeeded | 200/200 | | | | |

Variant-1's TTFT is +0.33 s against the baseline with the same answer LLM; its
267-character blurbs lengthen every retrieved chunk, as OLD's did in the Llama run (C_old +0.36 s).

---

## 6. Method and caveats

* **Answer LLM** restored to `casperhansen/llama-3-8b-instruct-awq` at its 8192-token window, exactly the Llama run's configuration.
* **Blurb LLM**: StatefulSet `crag-qwen-blurb` (2 replicas) with the answer-LLM pod's image (vLLM v0.21.0),
  `vllm-config` settings, 24 CPUs, 26 Gi request / 52 Gi limit, 10 GiB KV and 12 Gi `/dev/shm`; window 16384;
  OpenMP on 23 CPUs per replica, replica 0 on NUMA1 and replica 1 on NUMA0, clear of the answer LLM's CPUs.
  contextual-rag reaches it through its Service, as NEW reached the answer LLM in the earlier runs.
  A full copy of the answer LLM's deployment (4 replicas) did not fit the node's memory, so it has two.
* **Same as before**: query sample, harness, flags, hybrid settings, RAGAS judge (Llama-3-8B AWQ), NEW image.
* **Corpus**: re-ingested fresh; parity with the reference document set was checked after the ingest.
* **RAGAS**: 26 of 1,200 judge jobs failed (13 TimeoutError, 7 OutputParserException, 4 RagasOutputParserException, 2 LLMDidNotFinishException), excluded from the means.
* **Host memory**: with the answer LLM, the two blurb replicas and the two RAGAS judges all resident, the host ran
  out of memory during the first C evaluation (23:39 UTC): the kernel killed answer-LLM pod 1 mid-answer and the
  run stopped. The judges were then stopped while the evaluation, latency probe and isolated ingests ran, and
  the blurb deployment was scaled to 0 before the judges came back for scoring. The C evaluation was re-run from
  scratch, uninterrupted like every other setting; the ingest had finished before the event and is unaffected.
  The same event restarted the Redis vector-store cluster; its append-only file restored all 17,589 corpus keys
  (checked before the re-run evaluation and again before the isolated ingests). `edp-ingestion`, which still held
  connections from before that restart, failed the first isolated upload's pre-ingest clean-up; it was restarted,
  the failed upload deleted, and the isolated ingests run again from the first document.
* **Shared host**: the ingest, latency probe, isolated ingests and scoring each waited until no process of an
  unrelated index-building workload had been seen for 5 minutes.
* **Answer-quality comparisons with Qwen-answered rows** carry a judge-family caveat: the RAGAS judge is a Llama-3 model, the same family as the Llama answer model, and LLM judges tend to favour answers in their own style. Retrieval metrics have no judge in the loop.
* **n = 200**: only differences marked significant are established.

Artifacts: [src/tests/e2e/evals/evaluation/rag_eval/examples/results/multihop_200q_qwen_c_new_variant1/](src/tests/e2e/evals/evaluation/rag_eval/examples/results/multihop_200q_qwen_c_new_variant1/).

*Generated by make_report_v1.py from the result files above.*
