#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

"""Delete every ingested file and link from EDP, then wait until the corpus is empty.

A/B evaluations (baseline vs. contextual RAG) must start each run from an empty
corpus, otherwise the second run's retrieval mixes vectors produced by both
configurations. The evaluation harness has the primitives for this but no entry
point, so this script wires them together.
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

logger = get_erag_logger("clean_corpus")
change_erag_logger_level(logger, logging.INFO)


def main():
    parser = argparse.ArgumentParser(
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
        description="Delete all files/links from EDP so an evaluation run starts clean.")
    parser.add_argument("--output_dir", type=str, default="./output",
                        help="Only used to satisfy the evaluator constructor")
    parser.add_argument("--timeout", type=int, default=900,
                        help="Seconds to wait for the corpus to become empty")
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

    before = helper.list_files().json()
    logger.info(f"Corpus currently holds {len(before)} file(s).")
    for f in before:
        logger.info(f"  {f.get('object_name')}  status={f.get('status')}  "
                    f"chunks={f.get('chunks_total')}")
    if not before and not helper.list_links().json():
        logger.info("Corpus is already empty, nothing to do.")
        return 0

    helper.cleanup_all_files_and_links()

    # Deletion is asynchronous (a celery job removes the vectors), so poll.
    deadline = time.time() + args.timeout
    while time.time() < deadline:
        files = helper.list_files().json()
        links = helper.list_links().json()
        if not files and not links:
            logger.info("Corpus is empty.")
            return 0
        logger.info(f"Waiting for deletion: {len(files)} file(s), {len(links)} link(s) left "
                    f"({', '.join(sorted({f.get('status', '?') for f in files})) or '-'})")
        time.sleep(10)

    remaining = helper.list_files().json()
    logger.error(f"Timed out after {args.timeout}s with {len(remaining)} file(s) left: "
                 + ", ".join(f.get("object_name", "?") for f in remaining[:10]))
    return 1


if __name__ == "__main__":
    sys.exit(main())
