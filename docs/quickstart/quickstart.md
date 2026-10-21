# Quick Start

[← Docs Index](../README.md)

Intel AI for Enterprise RAG deploys as the **`erag` layer** on top of the Intel® AI for Enterprise Solutions platform.

This guide installs Kubernetes, the platform services, the model servers, and the RAG application itself, then leaves you with a working assistant at `https://<base_domain_name>` that you can ingest documents into.

> [!IMPORTANT]
> You clone and work from the **Enterprise AI Solutions** repository, not this one. Every command below runs from its root, and `init erag` clones this repository into `ext/` for you.

## Before you begin

Check [Prerequisites](prerequisites.md): Ubuntu 22.04/24.04 or RHEL 8+, passwordless sudo, internet access, minimum 60 cores / 128 GB RAM / 200 GB disk.

If the platform is already installed, skip to [Step 3](#step-3---initialize-the-rag-layer).

## Step 1 - Get the code and configure

Run from the Enterprise AI Solutions repo root:

```bash
git clone https://github.com/intel/enterprise-ai-solutions.git
cd enterprise-ai-solutions
./es_auto_installer.sh configure
```

## Step 2 - Install the platform (optional)

`install erag` in Step 4 auto-pulls the layers it depends on (infrastructure, platform, inference), so you can skip straight to [Step 3](#step-3---initialize-the-rag-layer).

To stage the platform separately, for example to confirm model serving works before adding RAG:

```bash
./es_auto_installer.sh install inference --env local
```

For multi-node or bring-your-own-Kubernetes, see the [Platform Quickstart](https://github.com/intel/enterprise-ai-solutions/blob/main/docs/quickstart/quickstart.md).

## Step 3 - Initialize the RAG layer

```bash
./es_auto_installer.sh init erag --env local
```

Seeds `env/local/config.erag.yaml`. Default flavour is `chatqna`. Others:

```bash
./es_auto_installer.sh init erag --env local --flavour docsum        # document summarization
./es_auto_installer.sh init erag --env local --flavour audioqna      # voice-enabled ChatQnA
./es_auto_installer.sh init erag --env local --flavour translation   # language translation
```

Available: `chatqna`, `docsum`, `audioqna`, `translation`, `pl_chatqna`.

> [!NOTE]
> The flavour is chosen at `init` time. Re-running `init erag --flavour <other>` on an existing environment is refused so your edits are not overwritten: use a fresh `--env`, or delete `env/<name>/config.erag.yaml` to reseed. To change the pipeline **after** installing, edit `pipeline_type` in `config.erag.yaml` and re-run `install erag` instead. See [Pipelines](../deploy/pipelines.md#switching-pipelines).

## Step 4 - Configure (optional)

Edit `env/local/config.erag.yaml` to customize if needed:

```yaml
inference_models:
  - name: llama3-8b-awq
    role: llm
  - name: nomic-embed
    role: embedding
  - name: bge-reranker-v2-m3
    role: reranking
```

For gated models (Llama, Mistral, Gemma):

```bash
export HF_TOKEN="hf_your_token_here"
```

For the limited single-user deployment (32 cores / 64 GB RAM), see [Prerequisites - Deploying on Minimum Hardware](prerequisites.md#deploying-on-minimum-hardware).

## Step 5 - Deploy

```bash
./es_auto_installer.sh install erag --env local
```

Installs: model servers, vector database, RAG microservices, EDP pipeline, UI, Keycloak. Takes 15-20 minutes.

## Step 6 - Verify

```bash
export KUBECONFIG=$(pwd)/env/local/kubeconfig.yaml
kubectl get pods -n llm-inference; kubectl get pods -n chatqna; kubectl get pods -n edp
./es_auto_installer.sh status --env local
```

Test the pipeline:

```bash
cd ext/enterprise.ai-erag/deployment
./scripts/test_connection.sh       # ChatQnA
./scripts/test_docsum.sh           # DocSum
./scripts/test_translation.sh      # Translation
```

## Step 7 - Access the UI

Ports 80/443 bind on the cluster node via `hostPort`.

**On the cluster node:**

```bash
echo "127.0.0.1 solutions.ai grafana.solutions.ai keycloak.solutions.ai s3.solutions.ai seaweedfs.solutions.ai" | sudo tee -a /etc/hosts
```

> [!IMPORTANT]
> Every subdomain must be listed explicitly. Wildcards do not work in `/etc/hosts`, and a missing entry shows up as a connection failure in the browser rather than as an error from the cluster. Replace `solutions.ai` with your `base_domain_name` if you changed it.

**From another machine:**

```bash
ssh -L 443:localhost:443 user@<cluster-ip>
```

Then add the same line to your local `/etc/hosts`.

**URLs:**

- RAG UI: `https://solutions.ai`
- Keycloak: `https://keycloak.solutions.ai`
- Grafana: `https://grafana.solutions.ai`

**Credentials:** `env/local/logs/rag/default_credentials.yaml` (one-time passwords; change after first login).

## Next steps

- [Install RAG Guide](../deploy/install_rag.md) - full deployment options and troubleshooting
- [Pipeline Configuration](../deploy/pipelines.md) - switch pipelines and variants
- [Configuration Reference](../customize/configuration.md) - model selection, multi-node, external endpoints
- [Data Ingestion](../deploy/install_rag.md#data-ingestion-ui-and-telemetry) - add documents
- [Teardown](../deploy/install_rag.md#remove-the-installation) - clean removal

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Pods stuck pending | `kubectl describe pod <name> -n <namespace>`. For minimum hardware, verify [tuning steps](prerequisites.md#deploying-on-minimum-hardware). |
| Models not deploying | Gated models need `export HF_TOKEN="hf_..."` before install. |
| Connection test fails | Wait for all pods `Running` in the pipeline namespace. |
| Install fails | Check `env/local/logs/install-erag-*.log`, then re-run (idempotent). |
