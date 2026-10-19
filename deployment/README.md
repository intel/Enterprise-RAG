# Intel® AI for Enterprise RAG deployment guide

This document details the deployment of Intel® AI for Enterprise RAG on Xeon.

---

## Overview

Intel® AI for Enterprise RAG is deployed as the **`erag` layer** on top of the Intel® AI for Enterprise Solutions, which is also the target name every installer command takes. This `deployment/` directory is a plug-in that contributes:

- **Ansible roles** (`app_*`) that orchestrate the RAG application components
- **Helm charts** (`components/`) for each microservice
- **Pipeline definitions** (`pipelines/`) for different AI workloads (ChatQnA, DocSum, AudioQnA, translation)
- **Component registry** (`components.yaml`) defining deployment order and dependencies

Enterprise AI Solutions manages the full stack: Kubernetes cluster provisioning, platform services (Istio, Keycloak, observability), model serving infrastructure, and this RAG application layer.

## Prerequisites

Cluster provisioning, storage backends, and node configuration are owned by Enterprise AI
Solutions, not by this layer. Run `./es_auto_installer.sh configure` once per machine to
install prerequisites (Python ≥3.11, yq, kubectl, helm), then see the Enterprise AI Solutions
`docs/quickstart/prerequisites.md` and `docs/deploy/topologies.md`.

`install erag` auto-pulls the layers it depends on (infrastructure, platform, inference),
so the platform does not have to be installed separately first.

## Deployment Workflow

All commands run from the **Enterprise AI Solutions repo root**, not from this repo.

### Initialize the Environment

Create an environment and seed configuration files:

```bash
cd /path/to/enterprise.ai-solutions
./es_auto_installer.sh init erag [--env <name>] [--flavour <name>]
```

- `--env <name>`: Environment name (default: `local`). Creates `env/<name>/`
- `--flavour <name>`: Pipeline preset (default: `chatqna`). Options: `chatqna`, `docsum`, `audioqna`, `translation`, `pl_chatqna`

**What `init erag` does:**
1. Clones inference and RAG repos into `ext/` at pinned revisions
2. Seeds `env/<name>/config.erag.yaml` from the selected flavour's `config.yaml`
3. Records the provisioned layer, its rev, and what it was seeded from in `env/<name>/.solutions.yaml`

The model catalog `env/<name>/models-rag.yaml` is seeded later, by `app_inference_models`
at `install erag` time, from `deployment/models.yaml`.

Edit `env/<name>/config.erag.yaml` to customize the deployment (models, enabled components, resource sizing, etc.). For multi-node clusters, edit `env/<name>/nodes.yaml` and `env/<name>/global_config.yaml`.

### Deploy the RAG Application

```bash
./es_auto_installer.sh install erag [--env <name>]
```

The installer:
1. Validates the environment and dependencies
2. Deploys the inference models via `app_inference_models` (see [Model Serving](#model-serving))
3. Installs RAG components in dependency order (vector DB, keycloak config, APISIX gateway, pipeline, EDP, UI, etc.)
4. Waits for all pods to become ready
5. Writes credentials to `env/<name>/logs/rag/`

### Model Serving

**Models are deployed automatically** by the `app_inference_models` component as part of `install erag`. You do not need to deploy them manually.

The installer:
- Reads model definitions from `inference_models` in `config.erag.yaml`
- Deploys them via `./model-manager` (located at the Enterprise AI Solutions repo root)
- Sizes them for the cluster topology (CPU, memory, replicas)
- Waits for readiness before proceeding with RAG microservices

Default models for the `chatqna` flavour:
- **LLM**: `llama3-8b-awq`
- **Embedding**: `nomic-embed`
- **Reranking**: `bge-reranker-v2-m3`

Models are deployed in the `llm-inference` namespace. The LLM is accessed via the AI Gateway (`ai-gateway.envoy-gateway-system.svc`); embedding and reranking services are accessed directly via KServe service names.

To customize models, edit the `inference_models` list in `env/<name>/config.erag.yaml` before running `install erag`:

```yaml
inference_models:
  - name: llama3-8b-awq
    role: llm
  - name: nomic-embed
    role: embedding
  - name: bge-reranker-v2-m3
    role: reranking
```

Each model must exist in `env/<name>/models-rag.yaml`, the catalog `app_inference_models` seeds at install time.

## Access and Credentials

### Access the UI

The erag-gateway binds ports 80 and 443 directly on the cluster node via `hostPort`. No `kubectl port-forward` is required.

**From another machine:**

1. Tunnel the port:
   ```bash
   ssh -L 443:localhost:443 user@<cluster-ip>
   ```

2. Update `/etc/hosts` on your local machine (on Windows: `C:\Windows\System32\drivers\etc\hosts`):

   ```
   127.0.0.1 solutions.ai grafana.solutions.ai keycloak.solutions.ai s3.solutions.ai seaweedfs.solutions.ai
   ```

   > The base domain is set via `base_domain_name` in `env/<name>/global_config.yaml` (default: `solutions.ai`). Each subdomain must be listed explicitly - wildcards are not supported in `/etc/hosts`. For DNS servers, you can use wildcard records: `*.solutions.ai A <IP>`.

**Access URLs:**

- Intel® AI for Enterprise RAG UI: `https://solutions.ai`
- Keycloak: `https://keycloak.solutions.ai`
- Grafana: `https://grafana.solutions.ai`
- SeaweedFS Filer: `https://seaweedfs.solutions.ai`
- S3 API: `https://s3.solutions.ai`

> If using self-signed certificates (default), access `https://s3.solutions.ai` in your browser before ingesting data to accept the certificate warning. Not required with custom SSL certificates.

### UI Credentials

After deployment completes, credentials are written to:

```
env/<name>/logs/rag/default_credentials.txt
env/<name>/logs/rag/default_credentials.yaml
```

These contain one-time passwords for the application admin and user. You will be required to change the password after the first login.

> Remove these files after the first successful login.

### Keycloak and Grafana Credentials

Default credentials for Keycloak and Grafana:
- **username:** admin
- **password:** stored in `env/<name>/logs/rag/default_credentials.yaml`

Change passwords after first login.

> Secure the password file after first login:
> ```bash
> ansible-vault encrypt env/<name>/logs/rag/default_credentials.yaml
> ```
> Once encrypted, subsequent installer runs that read it need the vault password passed
> through to Ansible: `./es_auto_installer.sh install erag --env <name> -- --ask-vault-pass`.

### Vector Store Credentials

Default credentials for the vector store (if deployed) are stored in `env/<name>/logs/rag/default_credentials.yaml` and generated on first deployment.

### Enhanced Dataprep Pipeline (EDP) Credentials

**SeaweedFS:**
- **S3 API Access** (`s3.solutions.ai`):
  - **Access Key:** `EDP_SEAWEEDFS_ACCESS_KEY` in `env/<name>/logs/rag/default_credentials.yaml`
  - **Secret Key:** `EDP_SEAWEEDFS_SECRET_KEY` in `env/<name>/logs/rag/default_credentials.yaml`

- **Admin Web UI** (`seaweedfs.solutions.ai`):
  - **Username:** `SEAWEEDFS_ADMIN_USER` in `env/<name>/logs/rag/default_credentials.yaml`
  - **Password:** `SEAWEEDFS_ADMIN_PASSWORD` in `env/<name>/logs/rag/default_credentials.yaml`

**Internal EDP services:**

- Redis:
  - **username:** default
  - **password:** stored in `env/<name>/logs/rag/default_credentials.yaml`

- Postgres:
  - **username:** edp
  - **password:** stored in `env/<name>/logs/rag/default_credentials.yaml`

**System Fingerprint Service:**

- Postgres:
  - **username:** fingerprint
  - **database:** system_fingerprint
  - **password:** stored in the `fingerprint-postgresql-secret` Kubernetes secret

### NATS Credentials

NATS JetStream authorizes clients with an NKey, which is always required. The `app_nats` role generates the NKey pair once and stores it in the `nats-auth` secret. Client components (GMC controller and router) mount the seed automatically. No manual credential management is required.

Transport encryption is provided by the Istio ambient mesh when Istio is enabled; otherwise connections are plaintext.

## Configure the Deployment

After initial installation, you can update the configuration by editing `env/<name>/config.erag.yaml` and re-running:

```bash
./es_auto_installer.sh install erag --env <name>
```

The deployment scripts detect changes and update only affected components, minimizing downtime. See the [Advanced Configuration Guide](../docs/customize/configuration.md) for tuning parameters.

## Data Ingestion, UI and Telemetry

For adding data to the knowledge base, use the **Data Ingestion** tab in the **Admin Panel** (available to admin users only). This tab is available in the **ChatQnA** and **AudioQnA** apps only. See the **Data Ingestion** section of the user guide for your app:

- [AudioQnA User Guide](../docs/Intel_AI_for_Enterprise_RAG_AudioQnA_User_Guide.pdf)
- [ChatQnA User Guide](../docs/Intel_AI_for_Enterprise_RAG_ChatQnA_User_Guide.pdf)
- [DocSum User Guide](../docs/Intel_AI_for_Enterprise_RAG_DocSum_User_Guide.pdf)

For Grafana dashboards, visit the [Telemetry Guide](../docs/operate/telemetry.md).

## Single Sign-On and SharePoint Integration

Single Sign-On and SharePoint ingestion share one Microsoft Entra ID app registration. Configuration is managed via flat variables in `env/<name>/config.erag.yaml`:

```yaml
erag_keycloak_oidc_endpoint: ""       # Entra OpenID Connect metadata document URL; enables SSO
erag_keycloak_oidc_alias: "enterprise-sso"
erag_keycloak_oidc_client_id: ""
erag_keycloak_oidc_client_secret: ""
erag_keycloak_oidc_tenant_id: ""      # Entra Directory (tenant) ID; additionally enables SharePoint
```

Leaving all variables empty disables both features. Partial configuration is rejected at install time.

Apply the configuration with:

```bash
./es_auto_installer.sh install erag --env <name>
```

For the full procedure, including Entra app roles, group ids, Microsoft Graph permissions, scheduled synchronization, and per-user site filtering, see [Single Sign-On and SharePoint Integration](../docs/customize/sharepoint.md).

## Remove the Installation

To remove Intel® AI for Enterprise RAG from your cluster:

```bash
./es_auto_installer.sh teardown erag --env <name>
```

This removes all RAG components in reverse dependency order. Models are undeployed automatically.

## Troubleshooting

### Test Deployment

To verify that the deployment was successful, run the appropriate test command for your pipeline:

**For ChatQnA Pipeline:**
```bash
cd /path/to/applications.ai.enterprise.ai-solutions/ext/enterprise.ai-erag/deployment
./scripts/test_connection.sh
```

Expected output:
```
deployment.apps/client-test created
Waiting for all pods to be running and ready....All pods in the chatqna namespace are running and ready.
Connecting to the server through the pod client-test-87d6c7d7b-45vpb using URL http://router-service.chatqna.svc.cluster.local:8080...
data: '\n'
data: 'A'
data: ':'
data: ' AV'
data: 'X'
data: [DONE]
Test finished successfully
```

**For DocSum Pipeline:**
```bash
./scripts/test_docsum.sh
```

**For Translation Pipeline:**
```bash
./scripts/test_translation.sh
```

### Debug Tool

If you encounter issues during or after deployment, use the Intel® AI for Enterprise RAG Debug Tool to collect comprehensive diagnostic information from your Kubernetes cluster.

For detailed instructions, refer to the [Debug Tool Guide](../docs/operate/troubleshooting.md).

### Status Check

View currently installed components:

```bash
./es_auto_installer.sh status --env <name>
```

This displays namespaces, pods, Helm releases, and endpoints.

---

## What's in This Directory

This `deployment/` directory is a plug-in consumed by Enterprise AI Solutions. It contains:

| Path | Purpose |
|------|---------|
| `roles/` | 21 `app_*` Ansible roles - 15 registered as components in `components.yaml`, the rest included as helpers |
| `components/` | Helm charts for each RAG component (apisix, audio, chat_history, edp, gmc, hpa, mcp_gateway, nats, ui, vector_databases, etc.) |
| `pipelines/` | Modular pipeline definitions (chatqna, docsum, translation, audioqna, pl_chatqna) - see [pipelines/README.md](pipelines/README.md) |
| `components.yaml` | Component registry defining the erag layer and its dependencies |
| `scripts/` | Test and helper scripts (`test_connection.sh`, `test_docsum.sh`, `calculate_replicas.py`, etc.) |
| `tools/` | `debug_tool.py` for diagnostics |

Enterprise AI Solutions (`es_auto_installer.sh`) discovers this directory via `configs/repos/repos.erag.yaml` (`deployment_subdir: deployment`) and merges it into the installation plan.

---

For more information:

- [Documentation index](../docs/README.md) - all guides for this layer
- [Advanced Configuration Guide](../docs/customize/configuration.md) - tuning parameters and customization
- [Pipeline Composition](pipelines/README.md) - steps, variants, and how a GMConnector is composed
