#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

"""Verify that every indexed document was actually contextualised.

A contextual-RAG evaluation is only measuring contextual RAG if the blurbs made it into
the index for *all* of the corpus. Partial coverage is silent: EDP reports every file as
`ingested` whether or not the contextual step ran, retrieval still works, and the accuracy
numbers come out looking like a valid -- but understated -- measurement of the feature.
That failure is real and easy to hit: an ingest that was retried, resumed, or run while
the flag was being flipped leaves a mix of contextualised and plain chunks.

This script joins the contextual-rag service log against EDP's live file list on the EDP
file UUID -- the id the service logs as `document <id>` -- and reports the three-way split:

* matched          -- indexed and contextualised (what coverage requires)
* indexed_only     -- indexed with NO blurb record: chunks in the index that the contextual
                      step never saw. Any of these means the run is invalid.
* contextualised_only -- blurbed, then deleted or re-ingested; harmless leftovers from an
                      earlier corpus, but a large count means the log spans several ingests.

Capture the log during the ingest, and capture EVERY replica of the service:

    for pod in $(kubectl -n edp get pods -o name | grep contextual-rag); do
        kubectl -n edp logs -f "${pod#pod/}" --since=5s > "output/ctx_${pod#pod/}.log" &
    done
    python verify_blurb_coverage.py --log output/ctx_*.log \\
        --out output/blurb_coverage.json

`kubectl logs deploy/<name>` follows exactly ONE pod. Capturing a 2-replica deployment
that way reports roughly half the corpus as `indexed_without_blurb` -- a measurement
artifact that is indistinguishable from a genuine half-contextualised index. Pass
`--expect_replicas` (or let it read the deployment) so an under-capture is called out as
such instead of being reported as a coverage failure.

Exit status is 0 only for full coverage, so it can gate an evaluation run.
"""

import argparse
import json
import logging
import os
import re
import sys

from comps.cores.mega.logger import change_erag_logger_level, get_erag_logger

from eval_multihop import (
    MultiHop_Evaluator,
    default_auth_file,
    default_cluster_config_dir,
    load_cluster_configuration_file,
    validate_config_files_exists,
)

logger = get_erag_logger("verify_blurb_coverage")
change_erag_logger_level(logger, logging.INFO)

# "Contextualized 31 chunk(s) of document <edp-file-uuid> in 24.6s via <url> (...)"
LINE = re.compile(
    r"Contextualized (?P<chunks>\d+) chunk\(s\) of document (?P<doc>\S+) in "
    r"(?P<seconds>[\d.]+)s")

# "Contextual RAG skipped for document <id>: its blurb prompt needs ..." -- left out on
# purpose: its blurb prompt does not fit CONTEXT_MAX_PROMPT_TOKENS, and documents are never
# truncated. Expected for the largest documents, so not a coverage failure.
SKIPPED = re.compile(r"Contextual RAG skipped for document (?P<doc>\S+):")

# EDP statuses that mean the file's chunks are in the vector index.
INDEXED = "ingested"


def read_blurb_log(paths):
    """Map EDP file id -> chunks contextualised (LAST attempt wins), plus the ids skipped
    because their blurb prompt does not fit the token budget."""
    contextualised, skipped = {}, set()
    for path in paths:
        with open(path, errors="replace") as log_file:
            for line in log_file:
                match = LINE.search(line)
                if match:
                    contextualised[match.group("doc")] = int(match.group("chunks"))
                    skipped.discard(match.group("doc"))
                    continue
                skip = SKIPPED.search(line)
                if skip:
                    skipped.add(skip.group("doc"))
                    contextualised.pop(skip.group("doc"), None)
    return contextualised, skipped


def main():
    parser = argparse.ArgumentParser(
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
        description="Check that every indexed document has a contextualisation record.")
    parser.add_argument("--log", type=str, action="append", required=True,
                        help="contextual-rag service log; repeat to merge several captures")
    parser.add_argument("--out", type=str, default=None, help="Where to write the report JSON")
    parser.add_argument("--expect", type=int, default=0,
                        help="Fail unless exactly this many documents are indexed; 0 = any")
    parser.add_argument("--replicas", type=int, default=0,
                        help="Replica count of the contextual-rag deployment. Given fewer "
                             "--log files than replicas, missing blurbs are reported as a "
                             "likely under-capture rather than a coverage failure; 0 = unknown")
    parser.add_argument("--output_dir", type=str, default="./output",
                        help="Only used to satisfy the evaluator constructor")
    parser.add_argument("--auth_file", type=str, default=default_auth_file(),
                        help="Path to auth file")
    parser.add_argument("--cluster_config_file", type=str, default=default_cluster_config_dir(),
                        help="Path to directory containing the cluster configuration YAMLs")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    validate_config_files_exists(args)
    load_cluster_configuration_file(args)
    evaluator = MultiHop_Evaluator(output_dir=args.output_dir, auth_file=args.auth_file)

    files = evaluator.edp_helper.list_files().json()
    indexed = {f["id"]: f for f in files if f.get("status") == INDEXED}
    other = [f for f in files if f.get("status") != INDEXED]

    contextualised, skipped = read_blurb_log(args.log)
    if not contextualised:
        logger.error(f"No contextualisation lines found in {args.log}. Was the log captured "
                     "during the ingest, and was contextual RAG actually enabled?")
        return 1

    matched = sorted(set(indexed) & set(contextualised))
    skipped_indexed = sorted(set(indexed) & skipped)
    indexed_only = sorted(set(indexed) - set(contextualised) - skipped)
    blurbed_only = sorted(set(contextualised) - set(indexed))

    # A blurb record whose chunk count disagrees with the indexed count means the document
    # was re-chunked after it was contextualised, so some indexed chunks carry no blurb.
    disagreements = [
        {"id": doc_id,
         "chunks_indexed": indexed[doc_id].get("chunks_total"),
         "chunks_contextualised": contextualised[doc_id],
         "object_name": indexed[doc_id].get("object_name")}
        for doc_id in matched
        if indexed[doc_id].get("chunks_total") != contextualised[doc_id]
    ]

    chunks_indexed = sum(f.get("chunks_total") or 0 for f in indexed.values())
    chunks_covered = sum(contextualised[d] for d in matched)
    coverage = (100.0 * len(matched) / len(indexed)) if indexed else 0.0

    report = {
        "logs": args.log,
        "log_files": len(args.log),
        "contextual_rag_replicas": args.replicas or None,
        "documents_indexed": len(indexed),
        "documents_contextualised_in_log": len(contextualised),
        "documents_matched": len(matched),
        "documents_indexed_without_blurb": len(indexed_only),
        "documents_skipped_over_budget": len(skipped_indexed),
        "chunks_in_skipped_documents": sum(indexed[d].get("chunks_total") or 0
                                           for d in skipped_indexed),
        "documents_blurbed_but_not_indexed": len(blurbed_only),
        "document_coverage_percent": round(coverage, 2),
        "chunks_indexed": chunks_indexed,
        "chunks_contextualised_matched": chunks_covered,
        "chunk_count_disagreements": disagreements,
        "files_not_indexed": [
            {"id": f.get("id"), "status": f.get("status"), "object_name": f.get("object_name")}
            for f in other],
        "sample_indexed_without_blurb": [
            {"id": d, "object_name": indexed[d].get("object_name"),
             "chunks_total": indexed[d].get("chunks_total")}
            for d in indexed_only[:20]],
    }

    if args.out:
        directory = os.path.dirname(args.out)
        if directory:
            os.makedirs(directory, exist_ok=True)
        with open(args.out, "w") as out_file:
            json.dump(report, out_file, indent=1)
        logger.info(f"Wrote {args.out}")

    logger.info(f"indexed documents:            {report['documents_indexed']}")
    logger.info(f"contextualised (in log):      {report['documents_contextualised_in_log']}")
    logger.info(f"matched:                      {report['documents_matched']} "
                f"({report['document_coverage_percent']}%)")
    logger.info(f"indexed WITHOUT a blurb:      {report['documents_indexed_without_blurb']}")
    logger.info(f"skipped over the budget:      {report['documents_skipped_over_budget']} "
                f"({report['chunks_in_skipped_documents']} chunks; intentional, not truncated)")
    logger.info(f"blurbed but not indexed:      {report['documents_blurbed_but_not_indexed']}")
    logger.info(f"chunks indexed:               {report['chunks_indexed']}")
    logger.info(f"chunks contextualised:        {report['chunks_contextualised_matched']}")

    # An incomplete capture and a half-contextualised index look identical from here, so say
    # so plainly rather than letting the caller read a measurement gap as a product defect.
    under_captured = args.replicas and len(args.log) < args.replicas
    if indexed_only and under_captured:
        logger.error(f"{len(args.log)} log file(s) given for a {args.replicas}-replica "
                     "deployment: the capture is incomplete, so the missing blurbs below are "
                     "probably records written by a replica that was never captured. Re-run "
                     "with one --log per pod before concluding anything about coverage.")

    failures = []
    if indexed_only:
        failures.append(f"{len(indexed_only)} indexed document(s) have no blurb record"
                        + (" (capture is incomplete -- see above)" if under_captured else ""))
    if disagreements:
        failures.append(f"{len(disagreements)} document(s) disagree on chunk count")
    if other:
        failures.append(f"{len(other)} file(s) are not in status '{INDEXED}'")
    if args.expect and len(indexed) != args.expect:
        failures.append(f"expected {args.expect} indexed documents, found {len(indexed)}")

    if failures:
        for failure in failures:
            logger.error(f"COVERAGE FAILURE: {failure}")
        logger.error("The index is only partly contextualised; an evaluation run on it would "
                     "understate contextual RAG. Re-ingest before evaluating.")
        return 1

    logger.info("Full coverage: every indexed document was contextualised"
                + (f", apart from {len(skipped_indexed)} skipped over the token budget."
                   if skipped_indexed else "."))
    return 0


if __name__ == "__main__":
    sys.exit(main())
