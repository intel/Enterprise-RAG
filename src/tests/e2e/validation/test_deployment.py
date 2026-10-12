#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

"""E2E tests validating Enterprise RAG deployment invariants.

Groups deployment-level checks that inspect the live cluster: NRI balloon CPU
policy for inference pods, and cluster-wide Pod Security Standards labelling of
namespaces. Each group carries its own skip condition, so an unrelated feature
being disabled never masks the others.
"""

import logging
import re
from collections import defaultdict

import allure
import kr8s
import pytest

from tests.e2e.validation.buildcfg import cfg
from tests.e2e.validation.constants import LLM_INFERENCE_NAMESPACE

logger = logging.getLogger(__name__)

NRI_ANN_PREFIX = "balloon.balloons.resource-policy.nri.io/"
NRI_PLUGIN_NAMESPACE = "kube-system"
NRI_PLUGIN_DAEMONSET = "nri-resource-policy-balloons"


def _nri_plugin_deployed() -> bool:
    """Return True when the NRI balloons policy DaemonSet exists in the cluster."""
    daemonsets = kr8s.get("daemonsets", NRI_PLUGIN_DAEMONSET, namespace=NRI_PLUGIN_NAMESPACE)
    return len(list(daemonsets)) > 0


nri_balloons_only = pytest.mark.skipif(
    not _nri_plugin_deployed(),
    reason=f"NRI balloons policy not deployed (no DaemonSet '{NRI_PLUGIN_NAMESPACE}/{NRI_PLUGIN_DAEMONSET}')",
)


def _parse_cpuset(spec: str) -> list[int]:
    """Parse a Linux cpuset string (e.g. '0-3,56-59') into a sorted list of CPU IDs."""
    cpus = set()
    for part in spec.strip().split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo, hi = part.split("-", 1)
            cpus.update(range(int(lo), int(hi) + 1))
        else:
            cpus.add(int(part))
    return sorted(cpus)


def _get_sibling_map(k8s_helper, pod) -> dict[int, int]:
    """Read thread_siblings_list from each CPU on the node to build a mapping
    of CPU ID -> its hyperthread sibling CPU ID.

    The raw output from the node looks like (one line per CPU):
        /sys/devices/system/cpu/cpu0/topology/thread_siblings_list:0,112
        /sys/devices/system/cpu/cpu1/topology/thread_siblings_list:1,113
        ...

    Each line lists the CPU IDs that share the same physical core.
    We parse this to produce {0: 112, 112: 0, 1: 113, 113: 1, ...}.
    """
    cmd = ["sh", "-c", "grep -r . /sys/devices/system/cpu/cpu*/topology/thread_siblings_list"]
    raw = k8s_helper.exec_in_pod(pod, cmd)

    sibling_map = {}
    for line in raw.strip().splitlines():
        match = re.match(r".*/cpu(\d+)/topology/thread_siblings_list:(.*)", line)
        if not match:
            continue
        cpu_id = int(match.group(1))
        siblings = _parse_cpuset(match.group(2))
        for s in siblings:
            if s != cpu_id:
                sibling_map[cpu_id] = s
                break
    return sibling_map


def _get_pod_cpuset(k8s_helper, pod) -> list[int]:
    """Read the effective cpuset assigned to a pod."""
    try:
        raw = k8s_helper.exec_in_pod(pod, ["cat", "/sys/fs/cgroup/cpuset.cpus.effective"])
        return _parse_cpuset(raw)
    except Exception:
        raw = k8s_helper.exec_in_pod(pod, ["cat", "/proc/self/status"])
        for line in raw.splitlines():
            if line.startswith("Cpus_allowed_list:"):
                return _parse_cpuset(line.split(":", 1)[1])
    return []


@pytest.fixture(scope="module")
def balloon_pod_data(k8s_helper):
    """Collect NRI balloon pods, their cpusets, and node topology.

    Returns a dict with:
        - balloon_pods: list of running pods with NRI balloon annotations
        - pod_cpusets: dict of {pod.name: [cpu_ids]}
        - sibling_maps: dict of {node_name: {cpu_id: sibling_cpu_id}}
    """
    pods = k8s_helper.list_pods(LLM_INFERENCE_NAMESPACE)
    balloon_pods = []
    for pod in pods:
        if pod.status.phase != "Running":
            continue
        anns = pod.metadata.get("annotations", {}) or {}
        for key in anns:
            if key.startswith(NRI_ANN_PREFIX):
                balloon_pods.append(pod)
                break

    assert len(balloon_pods) > 0, (
        f"No running pods with NRI balloon annotations found in namespace '{LLM_INFERENCE_NAMESPACE}'. "
        "Ensure inference models are deployed."
    )
    logger.info(f"Found {len(balloon_pods)} pods with NRI balloon annotations")

    sibling_maps = {}
    for pod in balloon_pods:
        node = pod.spec.nodeName
        if node not in sibling_maps:
            logger.info(f"Reading CPU topology from node '{node}' via pod '{pod.name}'")
            sibling_maps[node] = _get_sibling_map(k8s_helper, pod)

    pod_cpusets = {}
    for pod in balloon_pods:
        cpuset = _get_pod_cpuset(k8s_helper, pod)
        logger.info(f"Pod '{pod.name}' on node '{pod.spec.nodeName}': CPUs {cpuset}")
        pod_cpusets[pod.name] = cpuset

    return {
        "balloon_pods": balloon_pods,
        "pod_cpusets": pod_cpusets,
        "sibling_maps": sibling_maps,
    }


@nri_balloons_only
@pytest.mark.smoke
@allure.testcase("IEASG-T698")
def test_nri_cpu_no_collisions(balloon_pod_data):
    """Verify that NRI balloons assign exclusive physical CPU cores to each pod.

    NRI (Node Resource Interface) balloon policy pins each vLLM pod to a dedicated
    set of physical CPU cores to avoid contention. This test checks that no two pods
    share the same physical core — including the case where pods get different CPU IDs
    that are hyperthreading siblings of the same core.

    Example PASS (no overlap between pods):
        bge-base-en:   CPUs [0, 1, 2, 3]       -> physical cores 0, 1, 2, 3
        bge-reranker:  CPUs [56, 57, 58, 59]    -> physical cores 56, 57, 58, 59
        llama3-8b-awq: CPUs [4, 5, ..., 19]     -> physical cores 4-19

    Example FAIL (collision on physical core 2):
        pod-A: CPUs [0, 1, 2, 3]     -> physical cores 0, 1, 2, 3
        pod-B: CPUs [2, 4, 5, 6]     -> physical cores 2, 4, 5, 6
        -> Physical core 2 shared by pod-A and pod-B

    Example FAIL (hidden collision via hyperthreading — CPUs 3 and 115 are siblings
    on the same physical core):
        pod-A: CPUs [0, 1, 2, 3]     -> physical cores 0, 1, 2, 3
        pod-B: CPUs [115, 116, ...]  -> physical cores 3, 4, ...
        -> Physical core 3 shared by pod-A and pod-B
    """
    balloon_pods = balloon_pod_data["balloon_pods"]
    pod_cpusets = balloon_pod_data["pod_cpusets"]
    sibling_maps = balloon_pod_data["sibling_maps"]

    pods_by_node = defaultdict(list)
    for pod in balloon_pods:
        pods_by_node[pod.spec.nodeName].append({"name": pod.name, "cpus": pod_cpusets[pod.name]})

    collisions = []
    for node, node_pods in pods_by_node.items():
        sibling_map = sibling_maps.get(node, {})
        core_to_pods = defaultdict(list)
        for pod_info in node_pods:
            for cpu in pod_info["cpus"]:
                sibling = sibling_map.get(cpu, cpu)
                physical_core = min(cpu, sibling)
                if pod_info["name"] not in core_to_pods[physical_core]:
                    core_to_pods[physical_core].append(pod_info["name"])
        for core, pod_names in sorted(core_to_pods.items()):
            if len(pod_names) > 1:
                collisions.append(
                    f"Physical core {core} on node '{node}' shared by: {', '.join(pod_names)}"
                )

    assert collisions == [], (
        "CPU collisions detected — physical cores assigned to multiple pods:\n"
        + "\n".join(collisions)
    )


@nri_balloons_only
@pytest.mark.smoke
@allure.testcase("IEASG-T700")
def test_nri_physical_cores_only(balloon_pod_data):
    """Verify that pods received only physical CPU cores, not hyperthread siblings.

    NRI balloon policy with hideHyperthreads=true should assign one thread per
    physical core. For example, on a system with 120 physical cores (CPUs 0-119)
    and their hyperthreads (CPUs 120-239), a pod requesting 32 cores should get
    CPUs like [3-34] (all from the physical range), NOT [0-15, 120-135] (which
    would be 16 physical cores × 2 threads each).

    The test reads the CPU topology to determine which CPUs are "primary" (the
    lower-numbered thread of each physical core) and which are siblings. If any
    pod has been assigned a sibling CPU, the balloon policy failed to hide
    hyperthreads properly.

    Example PASS (all CPUs are primary threads):
        bge-base-en:   CPUs [0, 1, 2, 3]        -> all primary, no siblings
        llama3-8b-awq: CPUs [4, 5, ..., 19]     -> all primary, no siblings

    Example FAIL (pod got both threads of physical cores 0-15):
        llama3-8b-awq: CPUs [0, 1, ..., 15, 120, 121, ..., 135]
        -> CPUs 120-135 are hyperthread siblings of 0-15
        -> Pod is using thread pairs instead of unique physical cores
    """
    balloon_pods = balloon_pod_data["balloon_pods"]
    pod_cpusets = balloon_pod_data["pod_cpusets"]
    sibling_maps = balloon_pod_data["sibling_maps"]

    primary_cpus_per_node = {}
    for node, sibling_map in sibling_maps.items():
        primary = set()
        for cpu_id, sibling_id in sibling_map.items():
            primary.add(min(cpu_id, sibling_id))
        primary_cpus_per_node[node] = primary

    violations = []
    for pod in balloon_pods:
        cpuset = pod_cpusets[pod.name]
        node = pod.spec.nodeName
        primary_cpus = primary_cpus_per_node.get(node, set())
        sibling_map = sibling_maps.get(node, {})

        sibling_cpus_in_pod = []
        for cpu in cpuset:
            if primary_cpus and cpu not in primary_cpus:
                sibling_cpus_in_pod.append(cpu)

        if sibling_cpus_in_pod:
            physical_cores_used = set()
            for cpu in cpuset:
                sibling = sibling_map.get(cpu, cpu)
                physical_cores_used.add(min(cpu, sibling))
            violations.append(
                f"Pod '{pod.name}': got hyperthread siblings {sibling_cpus_in_pod} "
                f"(using {len(physical_cores_used)} physical cores × 2 threads "
                f"instead of {len(cpuset)} unique physical cores)"
            )
        else:
            logger.info(
                f"Pod '{pod.name}': CPUs {cpuset} — physical-only (no siblings)"
            )

    assert violations == [], (
        "Pods received hyperthread siblings instead of unique physical cores:\n"
        + "\n".join(violations)
    )


# Namespaces that legitimately carry no Pod Security Standards enforce label and
# are excluded from the scan. Kubernetes built-ins are owned by the cluster
# bootstrap, and local-path-storage is deployed by kubespray with no hook to
# label it before the provisioner starts (a documented limitation). Extend this
# blacklist with a justified entry when a run surfaces another exception, rather
# than narrowing the scan.
PSS_NAMESPACE_BLACKLIST = {
    "kube-system",
    "kube-public",
    "kube-node-lease",
    "default",
    "local-path-storage",
}

PSS_ENFORCE_LABEL = "pod-security.kubernetes.io/enforce"
VALID_PSS_PROFILES = ("privileged", "baseline", "restricted")


@pytest.mark.skipif(
    not cfg.get("enforce_pss", True),
    reason="enforce_pss is disabled for this deployment",
)
@pytest.mark.smoke
@allure.testcase("IEASG-T723")
def test_namespaces_have_pss_labels():
    """Verify every namespace in the cluster carries a valid PSS enforce label.

    With enforce_pss on (the platform default), every namespace the installer
    creates — across the platform, inference and RAG layers — is stamped by its
    role with pod-security.kubernetes.io/enforce set to one of privileged,
    baseline or restricted. This scans all namespaces and fails any that are
    missing the enforce label or carry an unexpected value, so a role that forgets
    to label its namespace is caught on every run.

    The scan is deliberately cluster-wide and blacklist-driven: everything is
    checked except the namespaces in PSS_NAMESPACE_BLACKLIST. When a run surfaces
    a namespace that legitimately cannot be labelled, add it there with a reason
    instead of restricting the scan to a known-good set.
    """
    violations = []
    for ns in kr8s.get("namespaces"):
        if ns.name in PSS_NAMESPACE_BLACKLIST:
            continue
        labels = ns.metadata.get("labels") or {}
        profile = labels.get(PSS_ENFORCE_LABEL)
        if profile not in VALID_PSS_PROFILES:
            violations.append(
                f"{ns.name}: {PSS_ENFORCE_LABEL}={profile!r} "
                f"(expected one of {VALID_PSS_PROFILES})"
            )

    assert violations == [], (
        "Namespaces missing a valid Pod Security Standards enforce label "
        "(add a justified exception to PSS_NAMESPACE_BLACKLIST if intended):\n"
        + "\n".join(violations)
    )
