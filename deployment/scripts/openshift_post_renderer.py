#!/usr/bin/env python3
# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0
"""
Helm post-renderer for OpenShift: drops runAsUser, runAsGroup and fsGroup from
every securityContext in the rendered manifests.

OpenShift's restricted-v2 SCC rejects a fixed UID or fsGroup outside the
namespace's range and assigns one itself when none is set; the images run as
any UID in group 0. Everything else in the securityContext stays.

Used by the roles' kubernetes.core.helm tasks when cluster_distribution is
openshift:  helm ... --post-renderer scripts/openshift_post_renderer.py
Reads the manifests on stdin, writes them to stdout.
"""

import sys

import yaml

DROP = ("runAsUser", "runAsGroup", "fsGroup")


def strip(node):
    if isinstance(node, dict):
        for key, val in node.items():
            if key == "securityContext" and isinstance(val, dict):
                for field in DROP:
                    val.pop(field, None)
            strip(val)
    elif isinstance(node, list):
        for item in node:
            strip(item)
    return node


def main():
    docs = [strip(d) for d in yaml.safe_load_all(sys.stdin) if d is not None]
    yaml.safe_dump_all(docs, sys.stdout, default_flow_style=False, sort_keys=False)


if __name__ == "__main__":
    main()
