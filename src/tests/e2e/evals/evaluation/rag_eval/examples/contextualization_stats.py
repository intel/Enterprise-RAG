#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

"""Aggregate contextual-RAG ingest timings from the contextual-rag microservice log.

The service logs one line per contextualised source document:

    Contextualized 31 chunk(s) of document 6f1c6b8e6bcb1c9d in 24.6s via
    http://<blurb-pod-ip>:8000 (whole document in prompt, largest prompt 5123 + 100 of 8192
    tokens).

(older builds logged "(~5123 prompt tokens, full document in prompt)"; both are read), and
one line per document left out because its blurb prompt does not fit the token budget:

    Contextual RAG skipped for document 6f1c6b8e6bcb1c9d: its blurb prompt needs ...

which is everything needed to report what a contextual ingest costs. Capture the log while
the corpus is being ingested, and capture EVERY replica:

    # WRONG: `logs deploy/...` follows exactly ONE pod. On a 2-replica deployment it sees
    # about half the documents, which looks indistinguishable from half the corpus never
    # having been contextualised at all.
    #   kubectl -n edp logs -f deploy/edp-contextual-rag > ctx.log

    # RIGHT: one capture per pod, merged with --log. Add a capture for any replica the
    # autoscaler adds mid-ingest, and re-dump before it can be scaled away again.
    for pod in $(kubectl -n edp get pods -o name | grep contextual-rag); do
        kubectl -n edp logs -f "${pod#pod/}" > "output/ctx_${pod#pod/}.log" &
    done
    python contextualization_stats.py --log output/ctx_*.log \\
        --out output/contextualization_200q.json

Records are keyed by document id, so overlapping or repeated captures of the same pod are
safe -- a duplicate line is counted once. A missing pod is not recoverable, so err towards
capturing too much.

Two per-chunk averages are reported, because they answer different questions:

* `blurb_service_time_per_chunk_s` -- blurb-stage seconds divided by chunks, i.e. the
  service time one chunk costs the contextualisation stage. This is the per-chunk price of
  the feature, and it is NOT the wall clock an ingest adds per chunk: documents are
  contextualised concurrently, so wall clock is this figure divided by the concurrency the
  ingest achieved. Divide the ingest driver's own elapsed time by the chunk count for that.
* `per_chunk_latency_s_estimated` -- the same figure multiplied by the observed concurrency
  of the document, i.e. roughly how long one blurb call takes end to end.

The timing covers blurb generation only. Fitting the document to the model's context
window happens before the timer starts, and embedding and indexing happen after the
service returns, so this is the cost contextual RAG adds to a chunk, not the cost of
ingesting one.

`blurb_stage_seconds_total` is the sum of per-document durations, i.e. aggregate service
time. Documents are contextualised concurrently -- by the celery workers and, when the
deployment is scaled out, across replicas -- so it is NOT the wall clock of the ingest.
Take wall clock from the ingest driver's own log; the ratio of the two is the concurrency
the ingest actually achieved.
"""

import argparse
import json
import re
import statistics
import sys

# "Contextualized 31 chunk(s) of document <id> in 24.6s via <url> (whole document in prompt,
#  largest prompt 5123 + 100 of 8192 tokens)" -- or, from older builds, "(~5123 prompt tokens, ...)"
LINE = re.compile(
    r"Contextualized (?P<chunks>\d+) chunk\(s\) of document (?P<doc>\S+) in "
    r"(?P<seconds>[\d.]+)s via (?P<url>\S+) \("
    r"(?:~(?P<tokens>\d+) prompt tokens|whole document in prompt, largest prompt (?P<largest>\d+) \+)"
    r"(?P<fit>[^)]*)\)")
# "Contextual RAG skipped for document <id>: its blurb prompt needs ..." -- left out whole
# because its blurb prompt does not fit CONTEXT_MAX_PROMPT_TOKENS (never truncated).
SKIPPED = re.compile(r"Contextual RAG skipped for document (?P<doc>\S+):")


def summarize(values, digits=3):
    if not values:
        return None
    return {
        "n": len(values),
        "mean": round(statistics.fmean(values), digits),
        "median": round(statistics.median(values), digits),
        "min": round(min(values), digits),
        "max": round(max(values), digits),
        "total": round(sum(values), digits),
    }


def main():
    parser = argparse.ArgumentParser(
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
        description="Summarise per-chunk contextualisation cost from a contextual-rag log.")
    parser.add_argument("--log", type=str, action="append", required=True,
                        help="Log file to read; repeat to merge several captures")
    parser.add_argument("--out", type=str, required=True, help="Where to write the summary JSON")
    parser.add_argument("--max_concurrency", type=int, default=32,
                        help="CONTEXT_MAX_CONCURRENCY of the deployment, used to turn the "
                             "throughput figure into a per-call latency estimate")
    args = parser.parse_args()

    documents = {}
    skipped = set()
    for path in args.log:
        with open(path, errors="replace") as log_file:
            for line in log_file:
                skip = SKIPPED.search(line)
                if skip:
                    skipped.add(skip.group("doc"))
                    continue
                match = LINE.search(line)
                if not match:
                    continue
                # A document contextualised twice (a retried ingest) must not be counted
                # twice; the last attempt is the one whose chunks were indexed.
                documents[match.group("doc")] = {
                    "chunks": int(match.group("chunks")),
                    "seconds": float(match.group("seconds")),
                    "prompt_tokens": int(match.group("tokens") or match.group("largest")),
                    "url": match.group("url"),
                    "truncated": "truncated" in match.group("fit"),
                }

    if not documents:
        print(f"ERROR: no contextualisation lines found in {args.log}", file=sys.stderr)
        return 1

    rows = list(documents.values())
    total_chunks = sum(r["chunks"] for r in rows)
    total_seconds = sum(r["seconds"] for r in rows)
    per_chunk = [r["seconds"] / r["chunks"] for r in rows]
    # Concurrency is capped both by the setting and by the number of chunks a document has.
    effective = statistics.fmean(min(args.max_concurrency, r["chunks"]) for r in rows)

    summary = {
        "logs": args.log,
        "documents": len(rows),
        "chunks": total_chunks,
        "chunks_per_document": round(total_chunks / len(rows), 2),
        "blurb_stage_seconds_total": round(total_seconds, 1),
        "blurb_stage_hours_total": round(total_seconds / 3600.0, 2),
        "blurb_service_time_per_chunk_s": round(total_seconds / total_chunks, 4),
        "blurb_service_time_per_chunk_s_mean_of_documents": round(
            statistics.fmean(per_chunk), 4),
        "per_chunk_latency_s_estimated": round(
            (total_seconds / total_chunks) * effective, 3),
        "mean_effective_concurrency": round(effective, 2),
        "max_concurrency_setting": args.max_concurrency,
        "per_document_seconds": summarize([r["seconds"] for r in rows], digits=2),
        "per_document_chunks": summarize([float(r["chunks"]) for r in rows], digits=2),
        "prompt_tokens": summarize([float(r["prompt_tokens"]) for r in rows], digits=1),
        "documents_truncated_to_fit_window": sum(1 for r in rows if r["truncated"]),
        "documents_skipped_over_budget": len(skipped - set(documents)),
        "model_server_replicas_used": {
            url: sum(1 for r in rows if r["url"] == url)
            for url in sorted({r["url"] for r in rows})
        },
    }

    with open(args.out, "w") as out_file:
        json.dump(summary, out_file, indent=1)

    print(f"Wrote {args.out}")
    print(f"  documents:                 {summary['documents']}")
    print(f"  chunks:                    {summary['chunks']} "
          f"({summary['chunks_per_document']} per document)")
    print(f"  blurb stage total:         {summary['blurb_stage_hours_total']} h "
          f"(aggregate service time, not wall clock)")
    print(f"  service time per chunk:    {summary['blurb_service_time_per_chunk_s']} s")
    print(f"  per-chunk latency (est.):  {summary['per_chunk_latency_s_estimated']} s "
          f"at effective concurrency {summary['mean_effective_concurrency']}")
    print(f"  documents truncated:       {summary['documents_truncated_to_fit_window']}")
    print(f"  documents skipped (budget): {summary['documents_skipped_over_budget']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
