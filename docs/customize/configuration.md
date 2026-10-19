# Configuration Reference

[← Customize](../README.md#customize)

RAG-specific settings in `env/<name>/config.erag.yaml`. This is the file you edit to change models, pipelines, storage, and features; the installer reads it on every `install erag` run and updates only the components a change affects.

> [!IMPORTANT]
> The override surface is **flat**. The file is loaded with `-e @file`, which merges shallowly, so a nested dictionary replaces the role default entirely instead of merging into it. Keep keys at the top level.

## Overview

```bash
./es_auto_installer.sh init erag --env local      # seeds config.erag.yaml
vi env/local/config.erag.yaml                     # (optional) customize
./es_auto_installer.sh install erag --env local   # deploys
```

Defaults: ChatQnA base, all components enabled, three models (LLM, embedding, reranking), Redis cluster vector store.

Edit when:

| Change needed | Setting |
|---------------|---------|
| Different pipeline/variant | `pipeline_type` / `pipeline_variant` |
| Disable component | `<component>_enabled: false` |
| Different models | `inference_models` |
| Different vector DB | `vector_databases_vector_store` |
| External S3 | `edp_storage_type` + `edp_s3_*` |
| SSO/SharePoint | `erag_keycloak_oidc_*` |

## Pipeline selection

| Setting | Default | Options |
|---------|---------|---------|
| `pipeline_type` | `chatqna` | `chatqna` \| `docsum` \| `translation` \| `audioqna` |
| `pipeline_variant` | `base` | `base` \| `retrieve-rerank` \| `upload` (ChatQnA only) |
| `solution_language` | `auto` | `auto` (Polish if LLM name has PLLuM/Bielik, else English) \| `en` \| `pl` |

Types: **chatqna** (RAG with retrieval/rerank/LLM), **docsum** (TextExtractor → TextCompression → TextSplitter → LLM → DocSum), **translation** (ALMA models, preview), **audioqna** (ChatQnA + ASR/TTS).

Variants: **base** (full), **retrieve-rerank** (no LLM, retrieval-only), **upload** (embedding-only, ingestion). See [pipelines.md](../deploy/pipelines.md).

## Component enablement

| Component | Default | Purpose |
|-----------|---------|---------|
| `vector_databases_enabled` | `true` | Vector DB (Redis/MSSQL/pgvector) |
| `chat_history_enabled` | `true` | PostgreSQL chat history |
| `edp_enabled` | `true` | Enhanced Data Preparation |
| `hpa_enabled` | `true` | Horizontal Pod Autoscaling |
| `ui_enabled` | `true` | React UI |
| `mcp_enabled` | `false` | Model Context Protocol gateway |

## Backup and restore

| Setting | Default | Purpose |
|---------|---------|---------|
| `backup_enabled` | `false` | Arms this layer's backup profile. Also needs the platform's `velero_enabled: true` and `storage_backend: nfs` or `ceph` — both switches are independent, and either off makes a run a no-op |
| `upgrade_backup_max_age_hours` | `6` | How fresh a backup the pre-upgrade gate demands, once `backup_enabled` is `true` |
| `allow_upgrade_without_backup` | `false` | Bypass the gate for one upgrade |

See [Backup and Restore](../operate/backup.md) for what is captured, how to run it, and the identity
realm.

## Inference models

```yaml
inference_models:
  - name: llama3-8b-awq
    role: llm
  - name: nomic-embed
    role: embedding
  - name: bge-reranker-v2-m3
    role: reranking
```

Each model name correspods to model definition defined in `env/<name>/models-rag.yaml` (seeded from `deployment/models.yaml`). Roles: `llm`, `embedding`, `reranking` are adding specific VLLM parameters to specific VLLM categories.

If you'd like to use a model, not listed in `models-rag.yaml`, add a new entry there with `name` + `model_id` and reference to it in `config.erag.yaml`.

Changing models: edit and re-install. Auto undeploys old, deploys new, downloads weights, waits for readiness. **Changing embedding invalidates index** - re-ingest all documents.

See [models.md](models.md).

## Vector database

| Setting | Default | Options |
|---------|---------|---------|
| `vector_databases_namespace` | `vdb` | |
| `vector_databases_vector_store` | `redis-cluster` | `redis-cluster` \| `mssql` \| `pgvector` |
| `vector_databases_vector_datatype` | `FLOAT32` | |
| `vector_databases_vector_dims` | `768` | Auto-detected; override if detection fails |

Backends: **redis-cluster** (production, 1M+ vectors, HA, scalable), **mssql** (SQL Server; RBAC unsupported; EULA prompt on deploy), **pgvector** (PostgreSQL).

Storage: default ~5GB. Increase in `deployment/components/vector_databases/values.yaml` (`persistence.size: 100Gi`). Vector store needs more storage than file storage (text + embeddings).

Details: [`deployment/components/vector_databases/README.md`](../../deployment/components/vector_databases/README.md).

## Enhanced Data Preparation (EDP)

| Setting | Default | Options |
|---------|---------|---------|
| `edp_namespace` | `edp` | |
| `edp_storage_type` | `seaweedfs` | `seaweedfs` \| `s3` \| `s3compatible` |
| `edp_late_chunking_enabled` | `false` | Not supported - [models.md](models.md#late-chunking) |
| `edp_rbac_enabled` | `false` | Must be `false` for ONTAP S3, MSSQL |
| `edp_scheduled_sync_enabled` | `false` | For S3-compatible sans SQS |

Backends: **seaweedfs** (in-cluster), **s3** (AWS + SQS), **s3compatible** (ONTAP S3, external MinIO). See [object_store.md](object_store.md).

## Authentication and SSO

SSO and SharePoint share one Entra app registration:

```yaml
erag_keycloak_oidc_endpoint: ""       # non-empty enables SSO
erag_keycloak_oidc_alias: "enterprise-sso"
erag_keycloak_oidc_client_id: ""
erag_keycloak_oidc_client_secret: ""
erag_keycloak_oidc_tenant_id: ""      # non-empty additionally enables SharePoint
```

No `_enabled` flags. All empty = disabled. Partial config rejected. See: [sharepoint.md](sharepoint.md), [auth.md](auth.md).

## MCP gateway

| Setting | Default |
|---------|---------|
| `mcp_enabled` | `false` |
| `mcp_namespace` | `mcp-gateway` |
| `mcp_keycloak_client_id` | `mcp-client` |

Exposes RAG as tools (`retrieve_context`, `list_buckets`, `ingest_url`, `ingest_file`, `check_ingestion_status`) over SSE. OAuth 2.0 client credentials. See [mcp.md](mcp.md).

## Container images

| Setting | Default | Notes |
|---------|---------|-------|
| `registry` | `docker.io/intel` | |
| `tag` | from `deployment/version.yaml` | Omit for default; mismatched version needs `tag_override: true` |
| `tag_override` | `false` | |
| `local_registry` | `false` | Multi-node |

See [images.md](images.md).

## Horizontal Pod Autoscaling

`hpa_enabled: true` (default). Scales pods by CPU/memory. Disable for: fixed workload, manual scaling, resource-constrained.

## UI

`ui_enabled: true` (default). `ui_chat_maintenance_mode: false` (auto-set to `true` for retrieve-rerank/upload).

## Node pinning

`namespace_node_selector: {}`. Pin pods to one node (`kubernetes.io/hostname: "worker-node-1"`). Single-node only. Topology detection runs on selected node. Requires `PodNodeSelector` admission plugin. Verify: `kubectl get namespace <ns> -o jsonpath='{.metadata.annotations.scheduler\.alpha\.kubernetes\.io/node-selector}'`.

## Routing mode

From `env/<name>/global_config.yaml`: **subdomain** (each service gets subdomain; needs wildcard DNS) or **path** (one FQDN, path-based; cloud-friendly). For `path`, update SSO redirect URIs.

## Additional settings

| Setting | Default |
|---------|---------|
| `inference_namespace` | `llm-inference` |
| `secure_logs` | `true` |
| `helm_timeout` | `10m0s` |
| `helm_retries` | `3` |

## Full template

```yaml
# config.erag.yaml - defaults
registry: "docker.io/intel"
# tag: "3.0.0"
# tag_override: false

pipeline_type: "chatqna"
pipeline_variant: "base"
# solution_language: "auto"

vector_databases_enabled: true
chat_history_enabled: true
edp_enabled: true
hpa_enabled: true
ui_enabled: true
mcp_enabled: false

backup_enabled: false
# upgrade_backup_max_age_hours: 6
# allow_upgrade_without_backup: false

inference_namespace: "llm-inference"
inference_models:
  - name: llama3-8b-awq
    role: llm
  - name: nomic-embed
    role: embedding
  - name: bge-reranker-v2-m3
    role: reranking

# ui_chat_maintenance_mode: false
# edp_namespace: "edp"
# edp_storage_type: "seaweedfs"
# edp_late_chunking_enabled: false
# edp_rbac_enabled: false
# edp_scheduled_sync_enabled: false
# edp_s3_compatible_access_key_id: ""
# edp_s3_compatible_secret_access_key: ""
# vector_databases_namespace: "vdb"
# vector_databases_vector_store: "redis-cluster"
# vector_databases_vector_datatype: "FLOAT32"
# vector_databases_vector_dims: 768
# erag_keycloak_oidc_endpoint: ""
# erag_keycloak_oidc_alias: "enterprise-sso"
# erag_keycloak_oidc_client_id: ""
# erag_keycloak_oidc_client_secret: ""
# erag_keycloak_oidc_tenant_id: ""
# mcp_namespace: "mcp-gateway"
# mcp_keycloak_client_id: "mcp-client"
# namespace_node_selector: {}
```

## Changing values

Edit `env/<name>/config.erag.yaml` and re-install, or override: `./es_auto_installer.sh install erag --env local -- -e mcp_enabled=true`.

Precedence: CLI `-e` > `global_config.yaml` > `config.erag.yaml` > role defaults.

## Related docs

[models.md](models.md) (models, multilingual, tuning), [auth.md](auth.md)/[sharepoint.md](sharepoint.md) (SSO, MFA, AD), [mcp.md](mcp.md) (MCP gateway), [object_store.md](object_store.md) (ONTAP S3), [images.md](images.md) (build images), [pipelines.md](../deploy/pipelines.md) (variants), [performance.md](../operate/performance.md) (tuning), [backup.md](../operate/backup.md) (backup and restore), [platform config](https://github.com/intel/enterprise-ai-solutions/blob/main/docs/customize/configuration.md).
