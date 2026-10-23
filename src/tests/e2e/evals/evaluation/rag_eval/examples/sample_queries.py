#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

"""Draw a reproducible random query sample from a MultiHop-RAG style dataset.

`eval_multihop.py --limits N` keeps the *first* N queries, which is not a random sample:
MultiHopRAG.json is grouped by question type, so a prefix over-represents whichever type
comes first and the result is not comparable to a run with a different limit. A/B
comparisons also need every setting to see exactly the same queries, which means the
sample has to be written down rather than re-drawn per run.

This script writes two files:

* the sample itself, in the dataset's own format, to be passed as
  `eval_multihop.py --dataset_path ... --limits 0`;
* a manifest recording the seed, the method, the population size, the question-type
  distribution of population and sample, the population indices drawn and a SHA-256 of the
  sample file, so a reader can tell whether two runs used the same queries.

    python sample_queries.py --dataset multihop_dataset/MultiHopRAG.json \\
        --n 200 --seed 20260909 \\
        --out multihop_dataset/MultiHopRAG_sample200.json \\
        --manifest output/sample200_manifest.json

Queries of type `null_query` are dropped first: they expect "Insufficient information"
and `eval_multihop.py` excludes them from every run, so sampling them would silently
shrink the evaluated set.
"""

import argparse
import collections
import hashlib
import json
import os
import random
import sys

NULL_QUERY = "null_query"


def type_distribution(queries):
    counts = collections.Counter(q.get("question_type") for q in queries)
    total = len(queries) or 1
    return {t: f"{n} ({100.0 * n / total:.1f}%)" for t, n in sorted(counts.items())}


def main():
    parser = argparse.ArgumentParser(
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
        description="Write a reproducible random query sample and its manifest.")
    parser.add_argument("--dataset", type=str, default="multihop_dataset/MultiHopRAG.json",
                        help="Source dataset holding the full query population")
    parser.add_argument("--n", type=int, required=True, help="Number of queries to sample")
    parser.add_argument("--seed", type=int, required=True,
                        help="Seed for random.Random; recorded in the manifest")
    parser.add_argument("--out", type=str, required=True,
                        help="Where to write the sample, in the dataset's own format")
    parser.add_argument("--manifest", type=str, required=True,
                        help="Where to write the sampling manifest")
    parser.add_argument("--compare-manifest", type=str, default=None,
                        help="Report how many sampled queries an earlier manifest also holds")
    args = parser.parse_args()

    with open(args.dataset) as dataset_file:
        population_all = json.load(dataset_file)

    # Keep the population indices of the pre-filter dataset: they identify a query even if
    # the null_query filter changes between dataset revisions.
    population = [(i, q) for i, q in enumerate(population_all)
                  if q.get("question_type") != NULL_QUERY]
    if args.n > len(population):
        print(f"ERROR: asked for {args.n} queries but only {len(population)} are answerable",
              file=sys.stderr)
        return 1

    # Shuffle a copy and take a prefix rather than random.sample: prefixes of one shuffle are
    # nested, so a 200-query sample is a subset of the 500-query sample drawn with the SAME
    # seed. That makes a smaller rerun comparable per query with the larger run it came from,
    # while still being a uniformly random sample of the population.
    order = list(population)
    random.Random(args.seed).shuffle(order)  # nosec B311 # reproducible eval sampling, not security
    drawn = order[: args.n]
    # Back to dataset order, so the run log reads in the same sequence as the dataset.
    drawn.sort(key=lambda pair: pair[0])

    indices = [i for i, _ in drawn]
    sample = [q for _, q in drawn]

    for path in (args.out, args.manifest):
        directory = os.path.dirname(path)
        if directory:
            os.makedirs(directory, exist_ok=True)

    with open(args.out, "w") as out_file:
        json.dump(sample, out_file, indent=1)
    with open(args.out, "rb") as out_file:
        digest = hashlib.sha256(out_file.read()).hexdigest()

    manifest = {
        "source_dataset": args.dataset,
        "sample_file": args.out,
        "seed": args.seed,
        "method": (f"random.Random({args.seed}).shuffle over the {len(population)} non-null "
                   f"queries, first {args.n} taken, then restored to dataset order"),
        "n_population": len(population),
        "n_sample": len(sample),
        "question_type_distribution": {
            "population": type_distribution([q for _, q in population]),
            "sample": type_distribution(sample),
        },
        "sha256_of_sample_file": digest,
        "population_indices": indices,
        "queries": [q.get("query") for q in sample],
    }

    if args.compare_manifest and os.path.exists(args.compare_manifest):
        with open(args.compare_manifest) as earlier_file:
            earlier = json.load(earlier_file)
        shared = set(earlier.get("queries") or []) & {q.get("query") for q in sample}
        manifest["overlap_with"] = {
            "manifest": args.compare_manifest,
            "n_that_sample": earlier.get("n_sample"),
            "n_shared_queries": len(shared),
        }

    with open(args.manifest, "w") as manifest_file:
        json.dump(manifest, manifest_file, indent=1)

    print(f"Wrote {len(sample)} queries to {args.out} (sha256 {digest[:12]}...)")
    print(f"Wrote manifest to {args.manifest}")
    print(f"population: {manifest['question_type_distribution']['population']}")
    print(f"sample:     {manifest['question_type_distribution']['sample']}")
    if "overlap_with" in manifest:
        print(f"overlap with {args.compare_manifest}: "
              f"{manifest['overlap_with']['n_shared_queries']} query(ies)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
