# Contextual RAG evaluation — MultiHop-RAG, 200 sampled queries

Evaluation of the Contextual RAG module added by [contextual_RAG_integration.md](contextual_RAG_integration.md),
run against a live ERAG deployment on 2026-09-09/10.

Three configurations of the same deployment, on the same corpus and the same 200 queries:

| Setting | Contextual blurbs | Retrieval | Fusion | Reranking |
|---|---|---|---|---|
| **A** — baseline ERAG | off | dense (vector) only | — | yes |
| **B** — contextual embeddings | on | dense (vector) only | — | yes |
| **C** — full Contextual RAG | on | dense + contextual BM25 | weighted RRF | yes |

**Headline:** Setting C removes **46.8 % of the baseline's retrieval failures**
(Hits@10 0.690 → 0.835, exact McNemar p = 2.4e-06). Most of that comes from the contextual
blurbs themselves (Setting B alone: 33.9 % fewer failures); the lexical leg and fusion add the
rest. The cost is **1.75 s of contextualisation service time per chunk, once, at ingest**, and
**+372 ms of TTFT per query** at serving time.

---

## 1. Quality: A vs B vs C

200 queries, MultiHop-RAG. Retrieval metrics are computed over a `top_n = 10` request that the
evaluator sends explicitly, so they do not depend on the deployment's configured `top_n`.

| Metric | A (baseline) | B (contextual embed) | C (full) | C vs A | B vs A |
|---|---|---|---|---|---|
| Hits@10 | 0.690 | 0.795 | **0.835** | **+21.0 %** | +15.2 % |
| Hits@4 | 0.635 | 0.720 | 0.720 | +13.4 % | +13.4 % |
| MAP@10 | 0.2527 | 0.2646 | **0.2887** | **+14.2 %** | +4.7 % |
| MRR@10 | 0.5374 | 0.5885 | **0.5979** | +11.3 % | +9.5 % |
| answer_correctness | 0.5535 | **0.6223** | 0.6198 | +12.0 % | +12.4 % |
| answer_relevancy | 0.7355 | 0.7311 | 0.7395 | +0.5 % | −0.6 % |
| answer_similarity | 0.5045 | 0.5073 | 0.5116 | +1.4 % | +0.6 % |
| context_precision | 0.6379 | **0.7772** | 0.7645 | +19.8 % | +21.8 % |
| context_recall | 0.7291 | 0.8002 | **0.8197** | +12.4 % | +9.8 % |
| faithfulness | 0.6069 | 0.6171 | **0.6283** | +3.5 % | +1.7 % |
| bleu-avg | 0.0053 | 0.0075 | 0.0073 | +37.7 % | +41.5 % |
| rouge-L | 0.0243 | 0.0291 | 0.0322 | +32.5 % | +19.8 % |
| avg. answer length (chars) | 574.98 | 630.47 | 606.06 | +5.4 % | +9.7 % |

Retrieval failure rate — the quantity the Contextual Retrieval method is usually reported on:

| Setting | failure rate (1 − Hits@10) | vs baseline |
|---|---|---|
| A | 0.310 | — |
| B | 0.205 | **33.9 % fewer failures** |
| C | **0.165** | **46.8 % fewer failures** |

### Is it significant? Paired, per-query

Every setting answered the same 200 queries, so the comparison can be made query by query
rather than on aggregates. `fixed` = queries the new setting retrieves correctly and the old
one missed; `broken` = the reverse.

| Comparison | fixed | broken | net | both hit | both miss | mean Δ Hits@10 | exact McNemar p |
|---|---|---|---|---|---|---|---|
| B vs A | 27 | 6 | **+21** | 132 | 35 | +0.105 | **0.00032** |
| C vs A | 34 | 5 | **+29** | 133 | 28 | +0.145 | **2.4e-06** |
| C vs B | 12 | 4 | +8 | 155 | 29 | +0.040 | 0.077 |

Both contextual settings beat the baseline decisively. **C vs B does not reach significance at
n = 200** (p = 0.077): the direction is consistent with the 500-query run, but on this sample
the incremental value of the lexical leg over contextual embeddings alone is suggestive, not
established. Distinguishing B from C reliably needs more queries than distinguishing either
from A.

### Where the gain comes from

| Question type | n | A | B | C |
|---|---|---|---|---|
| comparison_query | 82 | 0.7561 | 0.8171 | **0.8780** |
| inference_query | 74 | 0.6081 | 0.7973 | **0.8649** |
| temporal_query | 44 | 0.7045 | **0.7500** | 0.7045 |

The gain is not uniform. `inference_query` is where contextual RAG pays off most (+42 % for C
over A) — these are the questions whose answer chunks are only identifiable once the chunk
carries its document context. **`temporal_query` does not benefit at all**: C scores exactly the
baseline's 0.7045 and is *below* B's 0.7500. Date-anchored questions appear to be helped by the
blurb and then hurt by lexical fusion, plausibly because BM25 matches date strings that occur
across many unrelated documents. This is the clearest candidate for follow-up work.

---

## 2. Contextualisation cost (one-time, at ingest)

Measured from the `edp-contextual-rag` service log across **both** replicas during the
Setting B/C ingest.

| Quantity | Value |
|---|---|
| documents contextualised | 608 |
| chunks contextualised | 17,605 |
| chunks per document | 28.96 |
| **avg. contextualisation service time per chunk** | **1.7456 s** |
| avg. per chunk, mean over documents | 1.9361 s |
| **avg. wall clock added per chunk** | **0.3425 s** |
| blurb-stage aggregate service time | 8.54 h |
| ingest wall clock | 1.68 h (6030.1 s) |
| achieved ingest concurrency | 5.10× |
| est. latency of one blurb call | 40.5 s (at effective concurrency 23.19) |
| prompt tokens per blurb (mean / median / max) | 2530.6 / 1900.5 / 16,643 |
| documents truncated to fit context window | **0** |

**The two per-chunk figures answer different questions, and confusing them overstates the cost
by 5×:**

* **1.7456 s** is *service time* — the blurb-stage seconds one chunk costs. This is the price of
  the feature, and it is what you multiply by chunk count to size the LLM capacity you need.
* **0.3425 s** is *wall clock* — what a chunk actually adds to the elapsed time of an ingest,
  because documents are contextualised concurrently. The whole 17,605-chunk corpus was
  contextualised in 1.68 h of wall clock, not 8.54 h.

Contextualising this corpus cost **1.68 h of extra ingest wall clock, once**. No document
exceeded the model's context window, so every blurb saw its full source document.

**Provenance.** These results — accuracy and cost — were measured with a dedicated blurb
model, `Qwen/Qwen3-4B-Instruct-2507` in bf16 at its full 262144-token window, so every
document was contextualised whole. The shipped configuration writes the blurbs with a
dedicated `RedHatAI/Qwen3-4B-Instruct-2507-quantized.w8a8` model sized like the answer LLM,
and contextualises a document only if, for every one of its chunks, the blurb prompt plus
the `MAX_NEW_TOKENS` (100) blurb tokens fits `CONTEXT_MAX_PROMPT_TOKENS` (default 16384) —
never truncated, skipped otherwise; on MultiHop-RAG that is 606 of 607 documents. That
configuration was re-measured on the same 200 queries in
[contextual_RAG_evaluation_200q_Qwen_C_new_variant1.md](contextual_RAG_evaluation_200q_Qwen_C_new_variant1.md),
against a re-measured baseline and this report's whole-document implementation. The
baseline itself had moved since this run (Hits@10 0.785 instead of 0.690), because the
deployment now hands the reranker 30 candidates per query in every setting; the
whole-document implementation reproduced its own result (0.825 vs 0.835).

---

## 3. Serving latency per query

Streaming probe over the same 200 queries against the ChatQnA endpoint, measuring
time-to-first-token and inter-token time from the token stream itself. 200/200 succeeded in
every setting.

| Metric | A (baseline) | B (contextual embed) | C (full) |
|---|---|---|---|
| **avg. TTFT** | **1.223 s** | **1.376 s** | **1.595 s** |
| median TTFT | 1.262 s | 1.409 s | 1.593 s |
| p90 TTFT | 1.415 s | 1.564 s | 1.783 s |
| **avg. next-token time** | **45.27 ms** | **43.67 ms** | **40.78 ms** |
| median next-token time | 44.70 ms | 43.00 ms | 40.10 ms |
| pooled next-token time | 45.19 ms | 43.36 ms | 40.43 ms |
| avg. end-to-end answer | 6.398 s | 6.617 s | 6.351 s |
| avg. generated tokens | 114.5 | 120.8 | 117.5 |

**TTFT rises with retrieval work, as expected:** +153 ms for B (blurbs make chunks longer, so
more prompt to encode) and **+372 ms (+30 %) for C** over baseline, which additionally runs a
second retrieval leg, RRF fusion, and reranks 20 candidates instead of 10. End-to-end answer
time is flat across settings (6.35–6.62 s) because generation dominates.

**The next-token figures fall from A to C, and that should not be read as the feature making
generation faster.** Inter-token time is set by the vLLM serving engine's batching and by
sequence length, not by how documents were retrieved; the three probes ran at different times
against a shared engine. Treat the ~4.5 ms spread as environmental. The defensible latency
statement is the TTFT one.

---

## 4. Retrieval funnel actually observed

Confirms each setting ran the pipeline it was supposed to:

| Setting | retrieved-list depth | reranked chunks/query | chunks from BM25 leg only | retrieval median |
|---|---|---|---|---|
| A | 10 (200/200 queries) | 5.36 | 0 (0.0 %) | 0.730 s |
| B | 10 (200/200 queries) | 7.18 | 0 (0.0 %) | 0.777 s |
| C | **20** (200/200 queries) | 8.82 | **25 (1.42 %)** | 1.064 s |

Setting C's list depth of 20 is `hybrid_result_k`, and the 25 chunks with no `vector_distance`
are the direct evidence that the lexical leg changes the final context — they were found by
BM25 alone and would not exist in a dense-only run. At 1.42 % of reranked chunks, the lexical
leg is a small but real contributor, consistent with the modest and not-yet-significant C-vs-B
margin.

Setting C was independently verified live: **1002 retrievals, 100 % `Search Type=hybrid`, zero
fallbacks**, each fusing 100 vector + 100 BM25 candidates down to 20 at `rrf_k=0` with weights
0.8 / 0.2. Setting A logged **1092 retrievals, 100 % `Search Type=similarity`, zero BM25/RRF
lines**.

---

## 5. Method

**Query sample.** 200 of the 2255 non-null MultiHop-RAG queries, drawn with
`random.Random(20260821).shuffle` and restored to dataset order.
sha256 `23dd3de3a830…e289ca`; regenerating the sample from the recorded seed reproduced the file
byte-for-byte. The 200 are a strict subset of the 500 used in the earlier run, so the two are
directly comparable. Composition: comparison 82 (41.0 %), inference 74 (37.0 %), temporal 44
(22.0 %). Full manifest:
[results/multihop_200q/sample200_manifest.json](src/tests/e2e/evals/evaluation/rag_eval/examples/results/multihop_200q/sample200_manifest.json).

**Corpus parity.** All three settings retrieved from a corpus verified identical at **607
documents / 17,589 chunks**, checked three independent ways: the Redis index `num_docs`, the sum
of vector keys across `vdb-redis-cluster-0/1/2` (5923 + 5767 + 5899), and the sum of EDP's
per-file `chunks_total`. No orphaned or duplicated vectors.

**Blurb coverage.** For B and C, **100 % of indexed documents carry contextual blurbs** —
607/607 documents, 17,589 chunks contextualised against 17,589 chunks indexed, zero chunk-count
disagreements.

**Cross-check against the 500-query run.** Hits@10 / MAP@10 were A 0.628 / 0.2336, B 0.702 /
0.2425, C 0.808 / 0.2883. The ordering and the size of the C-over-A gain reproduce; absolute
values sit a little higher on this 200-query subset, which is expected sampling variation.

### Reproducing

```bash
EX=src/tests/e2e/evals/evaluation/rag_eval/examples

# Per setting: flip the flags, restart the consumers, ingest, then evaluate.
python $EX/eval_multihop.py --dataset_path MultiHopRAG_sample200.json \
    --docs_path $EX/multihop_dataset/corpus.json --output_dir output \
    --generation_metrics --retrieval_metrics --ragas_metrics

# Contextualisation cost -- one --log per replica (see below).
python $EX/contextualization_stats.py --log 'output/ctx_*.log' \
    --out output/contextualization_200q.json

# Serving latency.
python $EX/measure_latency.py --dataset MultiHopRAG_sample200.json --label C \
    --out output/latency_200q_C.json --fqdn erag.com --warmup 2

# Cross-setting comparison.
python $EX/compare_crag_settings.py \
    --setting A=output/report_s200_A.json \
    --setting B=output/report_s200_B.json \
    --setting C=output/report_s200_C.json \
    --compare B:A --compare C:A --compare C:B \
    --manifest output/sample200_manifest.json --out output/compare_s200_ABC.json
```

Flag flips take effect only after the consuming pods restart: `HYBRID_SEARCH_ENABLED`
(ConfigMap `extra-env-config`, ns `chatqa`) is consumed via `envFrom` and needs
`rollout restart deploy/retriever-svc-deployment`; `CONTEXTUAL_RAG_ENABLED` (ConfigMap
`edp-configmap`, ns `edp`) needs `edp-celery` restarted.

### Artifacts

Committed under
[src/tests/e2e/evals/evaluation/rag_eval/examples/results/multihop_200q/](src/tests/e2e/evals/evaluation/rag_eval/examples/results/multihop_200q/):
`compare_s200_ABC.json` (all aggregates, per-question-type splits, paired significance),
`latency_200q_{A,B,C}.json`, `contextualization_s200.json`, `blurb_coverage_BC.json`,
`sample200_manifest.json`. The per-query dumps (`report_s200_{A,B,C}.json`, ~2 MB each) and the
raw service logs are deliberately not committed.

---

## 6. Caveats and known issues

Things a reader needs in order to judge these numbers.

1. **`avg. LLM-score` is 0.0 in every setting and should be ignored.** The harness's LLM-judge
   parsing returns 0.0 regardless of setting; the same 0.0 appears in the earlier 500-query
   logs for all three settings. Answer quality here is carried by the RAGAS metrics, not by
   this field.

2. **bleu-avg and rouge-L improvements are within run-to-run noise — do not quote them.**
   Setting A was measured twice (see item 6): the two passes on identical configuration gave
   bleu-avg 0.0061 vs 0.0053 and rouge-L 0.0260 vs 0.0243. That ~15 % spread on a single
   setting is a large fraction of the ~20–40 % "improvements" in the table, and the absolute
   values (~0.005) are tiny. These metrics reward surface overlap with a short reference answer
   and are a poor fit for this task.

3. **Setting C vs B is not statistically established at n = 200** (McNemar p = 0.077). Only the
   comparisons against baseline are.

4. **Deployed `top_n` was 3, whereas the module ships a default of 5.** Kept at 3 for
   comparability with the published 500-query run. This does not affect the headline retrieval
   metrics: the evaluator requests `top_n: 10` explicitly, which was confirmed in the live
   request payloads. It does affect how many chunks reach the generator, so the RAGAS and
   generation columns correspond to `top_n = 3`.

5. **Two of 609 corpus documents fail to ingest in every setting, so the corpus is 607
   documents.** Both are deterministic libmagic mime-sniffing rejections, not contextual-RAG
   failures: document 179 begins with `From From …` and is sniffed as `application/mbox`, and
   document 477 leads with `Subject:` / `Message:` and is sniffed as `message/rfc822`. Identical
   in all three settings, so parity holds.

6. **Setting A was measured twice; the reported run is the second.** The first pass completed
   generation and then died 151/200 through RAGAS when `gmc-controller` (ns `system`)
   re-rendered `retriever-svc-deployment` from its own bundled manifest and replaced the pod
   mid-run, producing `ConnectionResetError(104)` on every subsequent retrieval. `gmc-controller`
   reverts both the image and `imagePullPolicy`, so the retriever must be re-checked before each
   pass. The rerun is a complete, self-consistent three-phase pass on the **stock upstream
   `opea/erag-retriever:2.3.0` image** — which is the most defensible definition of the
   baseline, and which logs `Search Type=similarity` identically, so Setting A is verified the
   same way. The first pass died before reaching the retrieval phase, so it yields no retrieval
   metrics to cross-check against; the only overlap between the two passes is the generation
   phase, whose spread is quantified in item 2. Every Setting A number reported above comes from
   the single completed rerun.

7. **The Setting A ingest was interrupted by a Redis restart and recovered.** The
   `vdb-redis-cluster-0` redis container exited cleanly (exitCode 0) at 10:13:11Z mid-ingest and
   restarted a minute later, failing 30 documents. It was not memory pressure (79 MB used
   against a 16 GiB limit, no `maxmemory`). Recovery re-uploaded the affected files in small
   batches; the standard `reingest_documents.py` could not be used because its delete-then-upload
   path blocks on a hardcoded 120 s deletion timeout that Redis missed while loaded. Final state
   was 607 ingested, and parity was then verified as described in §5 — so the recovery did not
   leave the corpus degraded.

8. **RAGAS reports occasional per-job judge failures in every setting** (A 2, B 32, C 26 —
   `OutputParserException`, `RagasOutputParserException`, `TimeoutError`). Affected jobs
   contribute NaN and are excluded from the mean. The counts are not equal across settings, so
   RAGAS columns carry slightly different effective sample sizes; the retrieval metrics, which
   have no judge in the loop, do not have this problem.

9. **Contextualisation cost must be captured from every replica.**
   `kubectl logs deploy/edp-contextual-rag` follows exactly *one* pod. On this 2-replica
   deployment a single-pod capture sees roughly half the documents, which is indistinguishable
   from half the corpus never having been contextualised — an earlier "~53 % blurb coverage"
   reading was this capture artifact, not a product defect. Actual coverage is 100 % (§5).
   `contextualization_stats.py` accepts one `--log` per pod and dedupes by document id.
