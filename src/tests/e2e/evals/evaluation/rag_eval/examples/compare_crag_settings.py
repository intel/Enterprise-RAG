#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

"""Compare Contextual RAG configurations evaluated on the same query set.

`eval_multihop.py` runs generation, RAGAS and retrieval as three passes that each rewrite the
same output file, so a finished report's `overall` block holds only the last pass's averages.
This script recovers the other two from the run log, folds all three into one `overall`
block per setting, and then compares the settings:

* per-metric deltas and relative improvements for every requested pair;
* the retrieval failure rate (1 - Hits@10) and its relative reduction, which is the quantity
  Anthropic's Contextual Retrieval post reports;
* a paired per-query analysis (queries fixed, one query = one pair) with an exact McNemar test
  on Hits@10, which is what makes a difference of a few points defensible.

    python compare_crag_settings.py \
        --setting A=output/report_s500_A.json --setting B=output/report_s500_B.json \
        --setting C=output/report_s500_C.json \
        --compare C:A --compare C:B --compare B:A \
        --out output/crag_improvement_summary_s500.json
"""

import argparse
import ast
import json
import math
import os
import sys

# Metrics where a higher value is better and 'improvement' is a relative gain. Everything
# reported by the harness is of that kind; the failure rate is derived and handled separately.
GEN_KEYS = ["avg. bleu-avg", "avg. bleu-1", "avg. bleu-2", "avg. bleu-3", "avg. bleu-4",
            "avg. rouge-L", "avg. LLM-score", "avg. length"]
RAGAS_KEYS = ["answer_correctness", "answer_relevancy", "answer_similarity",
              "context_precision", "context_recall", "faithfulness"]
RETR_KEYS = ["avg. Hits@10", "avg. Hits@4", "avg. MAP@10", "avg. MRR@10",
             "avg. Hits@10_retrieved", "avg. Hits@4_retrieved", "avg. MAP@10_retrieved",
             "avg. MRR@10_retrieved", "avg. gain_Hits@10", "avg. gain_Hits@4",
             "avg. gain_MAP@10", "avg. gain_MRR@10"]


def scrape_log(log_path):
    """Pull the generation and RAGAS aggregates out of a run log.

    tqdm writes progress with carriage returns, so aggregate lines can share a physical line
    with a progress bar; splitting on '\\r' as well as '\\n' is what makes them findable.
    """
    found = {}
    if not log_path or not os.path.exists(log_path):
        return found
    with open(log_path, errors="replace") as log_file:
        text = log_file.read().replace("\r", "\n")
    for line in text.split("\n"):
        for marker, key in (("Evaluation text generation overall:", "generation"),
                            ("Ragas metrics:", "ragas"),
                            ("Retrieval metrics:", "retrieval")):
            if marker in line:
                try:
                    found[key] = ast.literal_eval(line.split(marker)[1].strip())
                except (ValueError, SyntaxError):
                    pass
    return found


def load_setting(spec):
    name, path = spec.split("=", 1)
    with open(path) as report_file:
        report = json.load(report_file)
    log_path = os.path.splitext(path)[0] + ".log"
    # report_<tag>.json pairs with <tag>.log, not report_<tag>.log
    base = os.path.basename(path)
    if base.startswith("report_"):
        alt = os.path.join(os.path.dirname(path), base[len("report_"):].replace(".json", ".log"))
        if os.path.exists(alt):
            log_path = alt
    scraped = scrape_log(log_path)

    overall = dict(report.get("overall") or {})
    sources = {}
    for key, keys in (("generation", GEN_KEYS), ("ragas", RAGAS_KEYS), ("retrieval", RETR_KEYS)):
        block = scraped.get(key, {})
        present = [k for k in keys if k in overall]
        if present and not block:
            sources[key] = "report overall (last pass)"
            continue
        for k in keys:
            if k in block:
                overall[k] = block[k]
        if block:
            sources[key] = "report overall (last pass)" if present else "scraped from run log"
    per_query = {r["uuid"]: r for r in report.get("results", [])}
    return name, {"path": path, "log": log_path, "overall": overall,
                  "overall_sources": sources, "per_query": per_query,
                  "run_cmd": report.get("run_cmd")}


def improvement(new, old):
    """Relative change of a higher-is-better metric, in percent."""
    if old in (None, 0) or new is None:
        return None
    return round(100.0 * (new - old) / abs(old), 2)


def reduction(new, old):
    """Relative reduction of a lower-is-better quantity (e.g. failure rate), in percent."""
    if old in (None, 0) or new is None:
        return None
    return round(-100.0 * (new - old) / abs(old), 2)


def mcnemar_exact(b, c):
    """Two-sided exact McNemar p-value for b discordant one way and c the other."""
    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    tail = sum(math.comb(n, i) for i in range(0, k + 1)) / (2.0 ** n)
    return min(1.0, 2.0 * tail)


def paired(a, b, metric="Hits@10"):
    """Compare two settings query by query on one per-query metric."""
    shared = sorted(set(a["per_query"]) & set(b["per_query"]))
    fixed = broken = both_hit = both_miss = 0
    deltas = []
    for uuid in shared:
        va = a["per_query"][uuid]["retrieval_metrics"].get(metric)
        vb = b["per_query"][uuid]["retrieval_metrics"].get(metric)
        if va is None or vb is None:
            continue
        deltas.append(vb - va)
        if vb > va:
            fixed += 1
        elif vb < va:
            broken += 1
        elif va:
            both_hit += 1
        else:
            both_miss += 1
    return {"metric": metric, "n_shared_queries": len(shared),
            "fixed": fixed, "broken": broken,
            "both_hit": both_hit, "both_miss": both_miss,
            "net": fixed - broken,
            "mean_delta": round(sum(deltas) / len(deltas), 4) if deltas else None,
            "mcnemar_p_exact": mcnemar_exact(fixed, broken)}


def supplementary(setting):
    """Per-setting facts the aggregate metrics do not show.

    * retrieval-phase latency, measured from the gap between consecutive per-query timestamps
      (the phase is sequential, so the gap is one query's retrieve + rerank);
    * how deep the retrieved list was (10 for dense-only, `hybrid_result_k` for fusion) and how
      many chunks survived reranking;
    * how many reranked chunks carry no `vector_distance` — those were found by the BM25 leg
      alone, which is the only direct evidence that the lexical half changes the final context;
    * Hits@10 split by question type, because the benefit is not uniform across them.
    """
    import datetime as _dt
    from collections import Counter, defaultdict

    rows = list(setting["per_query"].values())
    if not rows:
        return {}

    stamps = sorted(_dt.datetime.strptime(r["log"]["evaluateDatetime"], "%Y-%m-%d %H:%M:%S.%f")
                    for r in rows if r.get("log", {}).get("evaluateDatetime"))
    gaps = [(b - a).total_seconds() for a, b in zip(stamps, stamps[1:])]

    retrieved = Counter(r["log"].get("num_retrieved_documents") for r in rows)
    reranked = [r["log"].get("num_reranked_documents") or 0 for r in rows]

    chunks = bm25_only = 0
    for r in rows:
        for doc in r["log"].get("reranked_documents", []):
            chunks += 1
            if not doc.get("vector_distance"):
                bm25_only += 1

    by_type = defaultdict(list)
    for r in rows:
        by_type[r["log"].get("query_type")].append(r["retrieval_metrics"].get("Hits@10", 0))

    return {
        "retrieval_phase_latency_s": {
            "median": round(sorted(gaps)[len(gaps) // 2], 3) if gaps else None,
            "mean": round(sum(gaps) / len(gaps), 3) if gaps else None,
            "phase_minutes": round((stamps[-1] - stamps[0]).total_seconds() / 60, 1) if gaps else None,
        },
        "retrieved_list_depth": {str(k): v for k, v in sorted(retrieved.items(), key=lambda x: -x[1])},
        "reranked_chunks": {
            "total": chunks,
            "mean_per_query": round(sum(reranked) / len(reranked), 2),
            "queries_with_full_top10": sum(1 for n in reranked if n >= 10),
            "found_by_bm25_leg_only": bm25_only,
            "found_by_bm25_leg_only_pct": round(100.0 * bm25_only / chunks, 2) if chunks else None,
        },
        "hits_at_10_by_question_type": {
            t: {"n": len(v), "hits_at_10": round(sum(v) / len(v), 4)}
            for t, v in sorted(by_type.items())
        },
    }


def main():
    parser = argparse.ArgumentParser(
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
        description="Compare Contextual RAG settings evaluated on the same queries.")
    parser.add_argument("--setting", action="append", required=True, metavar="NAME=REPORT.json",
                        help="A setting to include; repeat once per setting")
    parser.add_argument("--compare", action="append", required=True, metavar="NEW:OLD",
                        help="A pair to report improvements for; repeat as needed")
    parser.add_argument("--dataset", type=str, default="MultiHop-RAG",
                        help="Dataset label recorded in the summary")
    parser.add_argument("--manifest", type=str, default="output/sample500_manifest.json",
                        help="Query-sample manifest to reference in the summary")
    parser.add_argument("--out", type=str, required=True, help="Where to write the summary JSON")
    args = parser.parse_args()

    settings = dict(load_setting(s) for s in args.setting)

    n = {name: s["overall"].get("num") for name, s in settings.items()}
    if len({v for v in n.values() if v}) > 1:
        print(f"WARNING: settings do not share a query count: {n}", file=sys.stderr)

    metrics = {}
    for key in RETR_KEYS + RAGAS_KEYS + GEN_KEYS:
        row = {name: s["overall"].get(key) for name, s in settings.items()}
        if all(v is None for v in row.values()):
            continue
        for pair in args.compare:
            new, old = pair.split(":")
            row[f"delta_{new}_vs_{old}"] = (
                round(row[new] - row[old], 4)
                if row.get(new) is not None and row.get(old) is not None else None)
            row[f"improve_pct_{new}_vs_{old}"] = improvement(row.get(new), row.get(old))
        metrics[key] = row

    # The headline number of the Contextual Retrieval post: how often the right chunk is
    # missing from the top 10 retrieved documents.
    failure = {}
    for name, s in settings.items():
        hits = s["overall"].get("avg. Hits@10")
        failure[name] = round(1.0 - hits, 4) if hits is not None else None
    for pair in args.compare:
        new, old = pair.split(":")
        failure[f"reduction_pct_{new}_vs_{old}"] = reduction(failure.get(new), failure.get(old))

    significance = {}
    for pair in args.compare:
        new, old = pair.split(":")
        significance[f"{new}_vs_{old}"] = paired(settings[old], settings[new])

    summary = {
        "dataset": args.dataset,
        "queries": n,
        "query_sample_manifest": args.manifest,
        "settings": {name: {"report": s["path"], "log": s["log"],
                            "overall_sources": s["overall_sources"],
                            "run_cmd": s["run_cmd"],
                            **supplementary(s)}
                     for name, s in settings.items()},
        "retrieval_failure_rate_hits_at_10": failure,
        "metrics": metrics,
        "paired_per_query_hits_at_10": significance,
    }
    with open(args.out, "w") as out_file:
        json.dump(summary, out_file, indent=1)
    print(f"Wrote {args.out}")

    # A compact console view of what matters most.
    order = list(settings)
    print("\nretrieval failure rate (1 - Hits@10):")
    for name in order:
        print(f"  {name}: {failure[name]}")
    for pair in args.compare:
        new, old = pair.split(":")
        print(f"  {new} vs {old}: {failure[f'reduction_pct_{new}_vs_{old}']}% fewer failures")
    print("\npaired Hits@10 (fixed / broken, exact McNemar p):")
    for k, v in significance.items():
        print(f"  {k}: {v['fixed']} / {v['broken']}  net {v['net']}  p={v['mcnemar_p_exact']:.3g}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
