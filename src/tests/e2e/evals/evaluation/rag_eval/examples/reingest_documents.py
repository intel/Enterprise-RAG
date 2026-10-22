#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

"""Re-ingest individual corpus documents that got stuck part-way through the pipeline.

A batch ingest occasionally leaves a document in a non-terminal state (`text_splitting`,
`embedding`, ...) with no error: the batch reports success and the document is simply never
finished. For an A/B evaluation that is not cosmetic — a configuration missing a document
cannot retrieve the evidence in it, and the comparison is skewed. Use
enforce_corpus_parity.py to detect the discrepancy and this script to repair it.

This script cancels and deletes the named documents, re-uploads them from the per-document
corpus directory the harness writes (`tmp_corpus_docs/`), and waits for each to reach
`ingested`, so the corpus can be brought back to parity without re-ingesting all of it.

    python reingest_documents.py 579_subtle-as-a-sledgehammer-a-pop-icon-returns.txt ...
    python reingest_documents.py --stuck        # every document not in a terminal state
"""

import argparse
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

logger = get_erag_logger("reingest_documents")
change_erag_logger_level(logger, logging.INFO)

TERMINAL = ("ingested", "error", "canceled")


def main():
    parser = argparse.ArgumentParser(
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
        description="Delete and re-ingest individual corpus documents.")
    parser.add_argument("documents", nargs="*", help="object_name of each document to redo")
    parser.add_argument("--stuck", action="store_true",
                        help="Redo every document that is not in a terminal state")
    parser.add_argument("--corpus_dir", type=str, default="tmp_corpus_docs",
                        help="Directory holding one .txt per corpus document")
    parser.add_argument("--timeout", type=int, default=1800,
                        help="Seconds to wait for each document to reach 'ingested'")
    parser.add_argument("--output_dir", type=str, default="./output",
                        help="Only used to satisfy the evaluator constructor")
    parser.add_argument("--auth_file", type=str, default=default_auth_file(),
                        help="Path to auth file")
    parser.add_argument("--cluster_config_file", type=str, default=default_cluster_config_dir(),
                        help="Path to directory containing the cluster configuration YAMLs")
    args = parser.parse_args()

    validate_config_files_exists(args)
    load_cluster_configuration_file(args)
    evaluator = MultiHop_Evaluator(output_dir=args.output_dir, auth_file=args.auth_file)
    helper = evaluator.edp_helper

    files = helper.list_files().json()
    by_name = {f["object_name"]: f for f in files}

    targets = list(args.documents)
    if args.stuck:
        targets += [f["object_name"] for f in files if f.get("status") not in TERMINAL]
    targets = sorted(set(targets))
    if not targets:
        logger.info("Nothing to do.")
        return 0

    logger.info(f"Redoing {len(targets)} document(s)")
    for name in targets:
        entry = by_name.get(name)
        path = os.path.join(args.corpus_dir, name)
        if not os.path.exists(path):
            logger.error(f"{name}: no source file at {path}")
            return 1

        if entry:
            status = entry.get("status")
            logger.info(f"{name}: current status {status}, removing")
            if status not in TERMINAL:
                helper.cancel_processing_task(entry["id"])
                # The cancel has to land before the delete, or EDP refuses it.
                for _ in range(30):
                    cur = {f["object_name"]: f for f in helper.list_files().json()}.get(name)
                    if cur is None or cur.get("status") in TERMINAL:
                        break
                    time.sleep(2)
            cur = {f["object_name"]: f for f in helper.list_files().json()}.get(name)
            if cur is not None:
                url = helper.generate_presigned_url(
                    name, "DELETE", cur.get("bucket_name")).json().get("url")
                helper.delete_file(url)
                helper.wait_for_file_deletion(name)
            logger.info(f"{name}: deleted")

        logger.info(f"{name}: re-uploading")
        presigned = helper.generate_presigned_url(name).json().get("url")
        response = helper.upload_file(path, presigned)
        if response.status_code != 200:
            logger.error(f"{name}: upload failed with status {response.status_code}")
            return 1
        info = helper.wait_for_file_upload(name, "ingested", timeout=args.timeout)
        logger.info(f"{name}: ingested ({info.get('chunks_total')} chunk(s))")

    files = helper.list_files().json()
    status = {}
    for f in files:
        status[f.get("status")] = status.get(f.get("status"), 0) + 1
    chunks = sum(f.get("chunks_total") or 0 for f in files)
    logger.info(f"Corpus now holds {len(files)} file(s): {status}, {chunks} chunk(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
