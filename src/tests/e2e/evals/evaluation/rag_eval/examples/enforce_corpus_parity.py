#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

"""Make the ingested corpus match a snapshot taken from an earlier run.

Text extraction is not perfectly deterministic across runs: a document that failed once
can succeed the next time, and a single extra document is enough to skew an A/B
comparison, because the run that has it can retrieve evidence the other run cannot
possibly see.

This script deletes every successfully ingested file that is *not* in the snapshot, so the
two configurations index the identical document set. Files the snapshot has but this run
does not are reported and make the script fail — that direction cannot be repaired by
deleting anything; use reingest_documents.py to add them back.

    python enforce_corpus_parity.py --snapshot output/corpus_snapshot_contextual.json

Write a snapshot of the current corpus instead of enforcing one with --write-snapshot.
"""

import argparse
import json
import logging
import os
import sys
import time

from comps.cores.mega.logger import change_erag_logger_level, get_erag_logger

from eval_multihop import (
    MultiHop_Evaluator,
    default_auth_file,
    default_cluster_config_dir,
    load_cluster_configuration_file,
    validate_config_files_exists,
)

logger = get_erag_logger("corpus_parity")
change_erag_logger_level(logger, logging.INFO)

INGESTED = "ingested"


def summarize(files):
    status = {}
    for f in files:
        status[f.get("status")] = status.get(f.get("status"), 0) + 1
    chunks = sum(f.get("chunks_total") or 0 for f in files)
    return status, chunks


def main():
    parser = argparse.ArgumentParser(
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
        description="Align the ingested corpus with a snapshot from an earlier run.")
    parser.add_argument("--snapshot", type=str, required=True,
                        help="JSON file holding {'object_names': [...]} of the reference run")
    parser.add_argument("--write-snapshot", action="store_true",
                        help="Write the current corpus to --snapshot instead of enforcing it")
    parser.add_argument("--timeout", type=int, default=900,
                        help="Seconds to wait for asynchronous deletions to complete")
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
    helper = evaluator.edp_helper

    files = helper.list_files().json()
    status, chunks = summarize(files)
    logger.info(f"Corpus holds {len(files)} file(s): {status}, {chunks} chunk(s) total")

    if args.write_snapshot:
        names = sorted(f["object_name"] for f in files if f.get("status") == INGESTED)
        with open(args.snapshot, "w") as snapshot_file:
            json.dump({"n": len(names), "chunks_total": chunks, "object_names": names},
                      snapshot_file, indent=1)
        logger.info(f"Wrote snapshot of {len(names)} ingested document(s) to {args.snapshot}")
        return 0

    with open(args.snapshot) as snapshot_file:
        reference = set(json.load(snapshot_file)["object_names"])
    here = {f["object_name"] for f in files if f.get("status") == INGESTED}
    surplus = sorted(here - reference)
    missing = sorted(reference - here)

    logger.info(f"Reference: {len(reference)} document(s); this run: {len(here)} ingested")
    for n in surplus:
        logger.info(f"  surplus (will be deleted): {n}")
    for n in missing:
        logger.error(f"  MISSING versus the reference run: {n}")

    if surplus:
        # Deleting through EDP cascades to the vector store; keeping every other id is the
        # only way EdpHelper can express "remove exactly these".
        keep = {f["id"] for f in files if f["object_name"] not in surplus}
        helper.cleanup_all_files_and_links(file_ids_to_keep=keep)

        deadline = time.time() + args.timeout
        while time.time() < deadline:
            left = {f["object_name"] for f in helper.list_files().json()} & set(surplus)
            if not left:
                logger.info(f"Deleted {len(surplus)} surplus document(s)")
                break
            logger.info(f"Waiting for deletion of {len(left)} document(s)")
            time.sleep(10)
        else:
            logger.error(f"Timed out waiting to delete: {sorted(left)}")
            return 1

    files = helper.list_files().json()
    status, chunks = summarize(files)
    final = {f["object_name"] for f in files if f.get("status") == INGESTED}
    logger.info(f"Final corpus: {len(files)} file(s) {status}, {chunks} chunk(s), "
                f"{len(final)} ingested")
    if final != reference:
        logger.error(f"Corpus still differs from the reference: "
                     f"{len(final - reference)} surplus, {len(reference - final)} missing")
        return 1
    logger.info("Corpus matches the reference document set exactly.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
