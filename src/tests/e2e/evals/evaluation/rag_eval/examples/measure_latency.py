#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

"""Measure per-query serving latency of the ChatQnA pipeline: TTFT and inter-token time.

`eval_multihop.py` sends every query with `stream: false`, so a finished evaluation report
holds accuracy but no latency breakdown -- a non-streamed call cannot separate the time
spent retrieving and prefilling from the time spent generating. This script asks the same
queries with streaming enabled and times the Server-Sent Events as they arrive:

    request sent
      |--- ttft -------------->  first "data:" chunk carrying non-empty content. Retrieval,
      |                          reranking, prompt assembly and prefill all happen before
      |                          it, so TTFT is the whole pre-generation cost of a query --
      |                          which is where hybrid search shows up.
      |--- ... generation ---->  remaining chunks
      |                          inter_token_ms = (last_chunk - first_chunk) / (tokens - 1)
      |--- docs event -------->  "json:" line carrying the reranked documents. ChatQnA emits
                                 it *after* the answer stream, so it is a stream-completion
                                 timestamp and NOT a retrieval one.

It is deliberately sequential and single-threaded: these are latencies of an unloaded
pipeline, comparable between configurations, not a throughput benchmark.

    python measure_latency.py --dataset multihop_dataset/MultiHopRAG_sample200.json \\
        --fqdn erag.com --auth_file .../default_credentials.txt \\
        --label C --out output/latency_200q_C.json

One SSE content chunk is counted as one token. vLLM emits one token per chunk in the
OpenAI streaming format, so the two coincide unless the deployment sits behind a proxy
that coalesces events -- `chunks_per_second` is reported alongside so a coalescing proxy
shows up as an implausibly low token count.
"""

import argparse
import json
import os
import statistics
import sys
import time
import urllib3

import requests

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

DONE = "[DONE]"


def percentile(values, pct):
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, int(round((pct / 100.0) * (len(ordered) - 1))))
    return ordered[index]


def summarize(values, unit_scale=1.0, digits=1):
    """mean / median / p90 / min / max of a sample, or None for an empty one."""
    values = [v for v in values if v is not None]
    if not values:
        return None
    scaled = [v * unit_scale for v in values]
    return {
        "n": len(scaled),
        "mean": round(statistics.fmean(scaled), digits),
        "median": round(statistics.median(scaled), digits),
        "p90": round(percentile(scaled, 90), digits),
        "min": round(min(scaled), digits),
        "max": round(max(scaled), digits),
    }


def read_credentials(path):
    """Parse KEY=value lines, the format the installer writes default_credentials.txt in."""
    credentials = {}
    with open(path) as credentials_file:
        for line in credentials_file:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                credentials[key.strip()] = value.strip().strip('"')
    return credentials


def access_token(auth_domain, realm, client_id, username, password, timeout=30):
    response = requests.post(
        f"{auth_domain}/realms/{realm}/protocol/openid-connect/token",
        data={"username": username, "password": password,
              "grant_type": "password", "client_id": client_id},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        verify=False, timeout=timeout)
    response.raise_for_status()
    return response.json()["access_token"]


def ask(url, token, question, parameters, timeout):
    """Ask one question with streaming on and time the event stream.

    Returns a dict of timings, or one carrying `error` when the call fails. Timings are
    seconds relative to the moment the request was handed to requests.
    """
    started = time.perf_counter()
    stamps = {"time_to_first_byte": None, "time_to_docs_event": None, "ttft": None}
    content = []
    chunk_times = []
    try:
        with requests.post(url, headers={"Authorization": f"Bearer {token}",
                                         "Content-Type": "application/json"},
                           json={"text": question, "parameters": parameters},
                           stream=True, verify=False, timeout=timeout) as response:
            if response.status_code != 200:
                return {"error": f"HTTP {response.status_code}: {response.text[:200]}"}
            for line in response.iter_lines(decode_unicode=True):
                now = time.perf_counter() - started
                if stamps["time_to_first_byte"] is None:
                    stamps["time_to_first_byte"] = now
                if not line:
                    continue
                if line.startswith("json:"):
                    # Recorded for completeness: this event carries the reranked documents and
                    # arrives after the last answer token, so it times the whole stream rather
                    # than the retrieval stage.
                    stamps["time_to_docs_event"] = now
                    continue
                if not line.startswith("data: "):
                    continue
                payload = line.removeprefix("data: ").strip()
                if payload == DONE:
                    continue
                try:
                    chunk = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                choices = chunk.get("choices") or []
                text = choices[0].get("delta", {}).get("content", "") if choices else ""
                if not text:
                    continue
                if stamps["ttft"] is None:
                    stamps["ttft"] = now
                chunk_times.append(now)
                content.append(text)
    except requests.RequestException as exception:
        return {"error": f"{type(exception).__name__}: {exception}"}

    total = time.perf_counter() - started
    tokens = len(chunk_times)
    # Inter-token time is defined over the gaps between tokens, so it needs at least two.
    inter_token = ((chunk_times[-1] - chunk_times[0]) / (tokens - 1)) if tokens > 1 else None
    return {
        "total_s": total,
        "time_to_first_byte_s": stamps["time_to_first_byte"],
        "time_to_docs_event_s": stamps["time_to_docs_event"],
        "ttft_s": stamps["ttft"],
        "generation_s": (chunk_times[-1] - chunk_times[0]) if tokens > 1 else None,
        "tokens": tokens,
        "inter_token_s": inter_token,
        "chunks_per_second": round(tokens / total, 2) if total else None,
        "answer_chars": len("".join(content)),
    }


def main():
    parser = argparse.ArgumentParser(
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
        description="Measure TTFT and inter-token latency of the ChatQnA pipeline.")
    parser.add_argument("--dataset", type=str, required=True,
                        help="Query set; the same file the accuracy run used")
    parser.add_argument("--limits", type=int, default=0,
                        help="Ask only the first N queries of the dataset; 0 = all")
    parser.add_argument("--label", type=str, required=True,
                        help="Name of the configuration under test, recorded in the output")
    parser.add_argument("--out", type=str, required=True, help="Where to write the summary JSON")
    parser.add_argument("--fqdn", type=str, default="erag.com",
                        help="Base domain the deployment is published under")
    parser.add_argument("--auth_subdomain", type=str, default="auth",
                        help="Keycloak subdomain (2.x deployments publish it as auth.<fqdn>, "
                             "3.x as keycloak.<fqdn>); ignored when --auth_url is given")
    parser.add_argument("--auth_url", type=str, default=None,
                        help="Full Keycloak base URL, overriding --auth_subdomain")
    parser.add_argument("--realm", type=str, default="EnterpriseRAG", help="Keycloak realm")
    parser.add_argument("--client_id", type=str, default="EnterpriseRAG-oidc",
                        help="Keycloak client the password grant runs against")
    parser.add_argument("--auth_file", type=str, required=True,
                        help="Credentials file holding KEYCLOAK_ERAG_ADMIN_USERNAME/PASSWORD")
    parser.add_argument("--warmup", type=int, default=1,
                        help="Queries asked and discarded first, so the measured set does not "
                             "pay for a cold prefix cache or a cold connection pool")
    parser.add_argument("--request_timeout", type=int, default=600,
                        help="Per-query timeout in seconds")
    # Defaults mirror the pipeline parameters eval_multihop.py reads from the system
    # fingerprint, so latency is measured under the same decoding settings as accuracy.
    parser.add_argument("--temperature", type=float, default=0.01)
    parser.add_argument("--max_new_tokens", type=int, default=1024)
    parser.add_argument("--top_p", type=float, default=0.95)
    parser.add_argument("--top_k", type=int, default=10)
    parser.add_argument("--typical_p", type=float, default=0.95)
    parser.add_argument("--repetition_penalty", type=float, default=1.03)
    args = parser.parse_args()

    with open(args.dataset) as dataset_file:
        queries = [q["query"] for q in json.load(dataset_file) if q.get("query")]
    if args.limits > 0:
        queries = queries[: args.limits]
    if not queries:
        print("ERROR: no queries to ask", file=sys.stderr)
        return 1

    credentials = read_credentials(args.auth_file)
    auth_domain = args.auth_url or f"https://{args.auth_subdomain}.{args.fqdn}"
    token = access_token(auth_domain, args.realm, args.client_id,
                         credentials["KEYCLOAK_ERAG_ADMIN_USERNAME"],
                         credentials["KEYCLOAK_ERAG_ADMIN_PASSWORD"])
    url = f"https://{args.fqdn}/api/v1/chatqna"
    parameters = {
        "stream": True,
        "temperature": args.temperature,
        "max_new_tokens": args.max_new_tokens,
        "top_p": args.top_p,
        "top_k": args.top_k,
        "typical_p": args.typical_p,
        "repetition_penalty": args.repetition_penalty,
    }

    for i in range(min(args.warmup, len(queries))):
        result = ask(url, token, queries[i], parameters, args.request_timeout)
        print(f"[warmup {i + 1}] ttft={result.get('ttft_s')} error={result.get('error')}",
              flush=True)

    directory = os.path.dirname(args.out)
    if directory:
        os.makedirs(directory, exist_ok=True)
    per_query_path = os.path.splitext(args.out)[0] + ".jsonl"

    rows = []
    with open(per_query_path, "w") as per_query_file:
        for index, question in enumerate(queries):
            # The token outlives a long run only if it is refreshed; Keycloak's default
            # access-token lifetime is minutes, and a 200-query pass takes longer than that.
            if index and index % 25 == 0:
                token = access_token(auth_domain, args.realm, args.client_id,
                                     credentials["KEYCLOAK_ERAG_ADMIN_USERNAME"],
                                     credentials["KEYCLOAK_ERAG_ADMIN_PASSWORD"])
            row = ask(url, token, question, parameters, args.request_timeout)
            row["index"] = index
            row["query"] = question
            rows.append(row)
            per_query_file.write(json.dumps(row) + "\n")
            per_query_file.flush()
            print(f"[{index + 1}/{len(queries)}] "
                  f"ttft={_fmt(row.get('ttft_s'))}s "
                  f"itl={_fmt(row.get('inter_token_s'), 1000)}ms "
                  f"tokens={row.get('tokens')} "
                  f"total={_fmt(row.get('total_s'))}s "
                  f"{row.get('error') or ''}", flush=True)

    ok = [r for r in rows if not r.get("error")]
    summary = {
        "label": args.label,
        "dataset": args.dataset,
        "n_queries": len(rows),
        "n_failed": len(rows) - len(ok),
        "parameters": parameters,
        "per_query_file": per_query_path,
        "latency": {
            "ttft_s": summarize([r["ttft_s"] for r in ok], digits=3),
            "inter_token_ms": summarize([r["inter_token_s"] for r in ok],
                                        unit_scale=1000.0, digits=2),
            "time_to_docs_event_s": summarize([r["time_to_docs_event_s"] for r in ok],
                                              digits=3),
            "generation_s": summarize([r["generation_s"] for r in ok], digits=3),
            "total_s": summarize([r["total_s"] for r in ok], digits=3),
            "tokens": summarize([r["tokens"] for r in ok], digits=1),
        },
        # Mean of the per-query means is the per-query average the report quotes; the pooled
        # figure weights every token equally instead and is the throughput view of the same
        # data. They differ when answer lengths differ, so both are recorded.
        "pooled": {
            "total_tokens": sum(r["tokens"] for r in ok),
            "total_generation_s": round(sum(r["generation_s"] or 0 for r in ok), 3),
            "inter_token_ms_pooled": (
                round(1000.0 * sum(r["generation_s"] or 0 for r in ok)
                      / max(1, sum(max(0, r["tokens"] - 1) for r in ok)), 2) if ok else None),
        },
    }
    with open(args.out, "w") as out_file:
        json.dump(summary, out_file, indent=1)

    print(f"\nWrote {args.out} ({len(ok)}/{len(rows)} queries succeeded)")
    print(f"  avg TTFT:            {summary['latency']['ttft_s']['mean']} s")
    print(f"  avg inter-token:     {summary['latency']['inter_token_ms']['mean']} ms")
    print(f"  avg total:           {summary['latency']['total_s']['mean']} s")
    print(f"  pooled inter-token:  {summary['pooled']['inter_token_ms_pooled']} ms")
    return 0


def _fmt(value, scale=1.0, digits=2):
    return "n/a" if value is None else f"{value * scale:.{digits}f}"


if __name__ == "__main__":
    sys.exit(main())
