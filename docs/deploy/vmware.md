# Deploy on VMware

[← Docs Index](../README.md)

<p align="center">
    <img src="../images/vmware-logo.png" alt="VMware by Broadcom" width="500" />
</p>

This guide covers deploying the RAG chatbot onto virtual machines running on VMware vSphere: how many VMs to size, what the hypervisor has to expose for Intel AMX to be usable inside the guests, and the install steps that differ from a bare-metal deployment. The general install flow is unchanged, so read [Deploy the RAG Layer](install_rag.md) alongside it.

## Capacity Requirements

| Resource Type | Guidance |
|---|---|
| VMs | 5 VMs: 3 control plane VMs + 2 worker VMs |
| Logical Cores | 152 vCPUs total |
| RAM Memory | 352 GB total |
| Disk Space | 784 GB total |
| Operating System | Ubuntu 24.04 Server |
| Hypervisor | VMware vSphere / ESXi 8.0 |

### Intel AMX Requirements

| Requirement | Specification | Notes |
|---|---|---|
| BIOS Configuration | Intel AMX must be Enabled | Check "Intel AMX" or "Advanced Matrix Extensions" in BIOS |
| Minimum ESXi Version | 7.0 Update 3 or later (8.x preferred) | Required for AMX instruction support |
| VM Hardware Compatibility | Version 20 (introduced with vSphere 8.0) | Older versions mask AMX features |
| EVC Mode | Must be set to Sapphire Rapids or higher or Disabled | If set to older generations (Ice Lake, Cascade Lake), AMX will be masked |

**Pre-deployment Checklist:**
- Is Intel AMX enabled in the host BIOS?
- Are hosts running ESXi 7.0 U3 or later?
- Is VM hardware version set to v20?
- Is cluster EVC baseline set to Sapphire Rapids or disabled?

## Node Reference

| Node | Role | vCPUs | RAM | Storage |
|---|---|---|---|---|
| controlVM0 | Control Plane | 8 | 32 GB | 128 GB |
| controlVM1 | Control Plane | 8 | 32 GB | 128 GB |
| controlVM2 | Control Plane | 8 | 32 GB | 128 GB |
| workerVM3 | Worker (Primary) | 64 | 128 GB | 200 GB |
| workerVM4 | Worker | 64 | 128 GB | 200 GB |
| **Total** | | **152 vCPUs** | **352 GB** | **784 GB** |

Control plane nodes handle Kubernetes orchestration only. All AI inference workloads run on worker nodes.

## AI Sizing Guide

| Resource Type | Guidance | Comments / Examples |
|---|---|---|
| LLM Model Size | Up to 8B parameters | casperhansen/llama-3-8b-instruct-awq - AWQ quantized, served via vLLM on CPU |
| Embedding Model | ~0.1B parameters | nomic-ai/nomic-embed-text-v1 |
| Reranking Model | ~0.6B parameters | BAAI/bge-reranker-v2-m3 |
| Model Storage | 130 Gi total | 100 Gi LLM + 20 Gi embedding + 10 Gi reranker |

> **Note**: These specifications are guidance for a baseline deployment. Larger models can be used depending on your specific use case requirements and SLA targets. Consider scaling compute resources accordingly for larger model deployments.

## Steps

1. Tools Installation
2. Deploy Kubernetes Cluster on vSphere
3. Deploy Intel® AI for Enterprise RAG Application

### 1. Tools Installation

Install the following tools on your deployment machine (the VM you will be running commands from - recommended: workerVM3).

**Installer setup**

SSH into one of the VMs (for example vm3), clone Enterprise AI Solutions, and let it prepare the machine. `configure` installs Python 3.11+, yq, kubectl, helm, and builds the Ansible virtual environment, so there is no per-repo venv to create.

```bash
git clone https://github.com/intel/enterprise-ai-solutions.git
cd enterprise-ai-solutions

./es_auto_installer.sh configure
./es_auto_installer.sh init erag
```

`init erag` clones this repository and the inference layer into `ext/` at their pinned revisions. Every command from here runs from this directory.

### 2. Deploy the Kubernetes cluster on vSphere

Describe the VMs in `env/local/nodes.yaml` and `env/local/inventory/hosts.yaml`, then let the installer provision the cluster. See the Enterprise AI Solutions [Multi-Node and BYO Cluster guide](https://github.com/intel/enterprise-ai-solutions/blob/main/docs/deploy/topologies.md).

If vSphere already provides the cluster, set `existing_kubernetes` in `env/local/global_config.yaml` to its kubeconfig path instead.

### 3. Deploy Intel® AI for Enterprise RAG

```bash
./es_auto_installer.sh install erag
```

This pulls in the infrastructure, platform, and inference layers first. Full walkthrough → [Deploy the RAG Layer](install_rag.md).

## Debugging Commands

For comprehensive debugging guidance, see [Troubleshooting](../operate/troubleshooting.md).

| Command | What it does |
|---|---|
| `kubectl get pods -A` | Check status of all pods |
| `kubectl get nodes` | Check all nodes are registered |
| `kubectl describe pod <n> --namespace <ns>` | Get detail on a specific pod |
| `kubectl logs -n chatqna <pod name>` | View logs for a ChatQnA pod |
| `kubectl describe node <node name>` | Get detail on a specific node |
| `kubectl get services -n auth-apisix` | Check the APISIX gateway services and external access |
