# Performance

Recommendations for optimizing Intel AI for Enterprise RAG deployment performance.

## LLM Model Selection

To change the LLM model, edit `inference_models` in `env/<name>/config.erag.yaml` before deploying the pipeline. Each entry maps to a model in `env/<name>/models-rag.yaml` (or `models.yaml`).

```yaml
inference_models:
  - name: llama3-8b-awq
    role: llm
  - name: nomic-embed
    role: embedding
  - name: bge-reranker-v2-m3
    role: reranking
```

Redeploy the model with `./model-manager deploy <name> --wait` (from the Enterprise AI Solutions repo root).

## Vector Database Selection

Intel AI for Enterprise RAG supports the following vector database backends:

| Backend | Use case | Scale |
|---------|----------|-------|
| `redis-cluster` | Multi-node cluster for production | 1M+ vectors |
| `mssql` | Microsoft SQL Server 2025 Express Edition | SQL-based vector operations |
| `pgvector` | PostgreSQL with pgvector extension | General-purpose |

Set via `vector_databases_vector_store` in `env/<name>/config.erag.yaml`:

```yaml
vector_databases_enabled: true
vector_databases_namespace: vdb
vector_databases_vector_store: redis-cluster   # redis-cluster | mssql | pgvector
```

Per-store Helm payloads live under the `vector_databases_stores` key (nested, because the chart consumes them shaped that way); everything else in `config.erag.yaml` is flat.

Selecting `mssql` requires accepting the Microsoft SQL Server EULA during deployment. Role-based access control (RBAC) for vector databases is not supported when using `mssql`.

## Redis Vector Database Performance

Starting with Redis 8.2, use `SVS-VAMANA` as the recommended vector index backend for Intel AI for Enterprise RAG deployments, especially for medium/large datasets. It is optimized for better memory efficiency and query throughput while maintaining high recall.

These are Helm values, not Ansible variables, so set them in `deployment/components/edp/values.yaml` under `ingestion.config`:

```yaml
ingestion:
  config:
    vector_algorithm: "SVS-VAMANA"     # FLAT | HNSW | SVS-VAMANA (default FLAT)
    vector_datatype: "FLOAT32"
    vector_distance_metric: "COSINE"
```

If your priority is faster index build time or compatibility with existing tuning profiles, `HNSW` remains a valid alternative.

The three supported vector algorithms:
- **`FLAT`** - brute-force exact search, no index build time, best for small datasets (default)
- **`HNSW`** - approximate nearest neighbor with fast index builds, good general-purpose choice
- **`SVS-VAMANA`** - Intel-optimized approximate search with better memory efficiency and query throughput, recommended for medium/large datasets

**Critical:** The retriever and ingestion services **must** use the same `vector_algorithm` and matching parameters. These settings are automatically propagated to the retriever from `edp.ingestion.config` in `config.erag.yaml`. If they mismatch, each service will create a separate index in Redis and queries will return no results. After changing the algorithm, re-upload all files so data is re-indexed with the new algorithm.

### Verifying the Redis Vector Index

After deploying or changing the vector algorithm, verify that a **single** index exists in Redis. Two indexes indicate a mismatch between the retriever and ingestion `vector_algorithm` settings.

To check, exec into one of the Redis cluster pods:

```bash
kubectl exec -it <redis-cluster-pod> -c redis -- redis-cli -a <redis-password> FT._LIST
```

This should return **exactly one** index name. If you see two indexes, the retriever and ingestion are using different algorithms.

The index name encodes the configuration: `<model>_<algorithm>_<datatype>_<metric>_<dims>_index` (e.g., `nomic-ai/nomic-embed-text-v1_svs-vamana_float32_cosine_768_index`). Compare the algorithm in each index name to identify which service created it. Fix the configuration so both use the same `vector_algorithm`, redeploy, and re-upload your files.

To inspect index details (algorithm, vector dimensions, number of documents):

```bash
kubectl exec -it <redis-cluster-pod> -c redis -- redis-cli -a <redis-password> FT.INFO <index_name>
```

Look for the `algorithm` field in the output to confirm it matches your configured `vector_algorithm`.

### SVS-VAMANA with LeanVec4x8 Compression

The default Redis 8.2.2 image supports SVS-VAMANA with basic 8-bit quantization only. To use `LeanVec4x8` compression (recommended for better memory efficiency), build a custom Redis image with Intel SVS optimizations enabled.

1. Build the custom image using the Dockerfile in `src/comps/vectorstores/impl/redis/redis-svs-vamana/`:

```bash
cd src/comps/vectorstores/impl/redis/redis-svs-vamana
docker build -t <registry>/erag/redis:8.2.2-svs .
docker push <registry>/erag/redis:8.2.2-svs
```

2. Configure the custom image and SVS-VAMANA with LeanVec4x8 compression in `env/<name>/config.erag.yaml`:

```yaml
vector_databases_stores:
  redis-cluster:
    image:
      repository: <registry>/erag/redis
      tag: "8.2.2-svs"
```

The index algorithm itself is a Helm value, not an Ansible variable. Set `ingestion.config.vector_algorithm` to `SVS-VAMANA` in `deployment/components/edp/values.yaml` (it accepts `FLAT`, `HNSW`, or `SVS-VAMANA`; the default is `FLAT`).

For detailed trade-offs and parameter tuning see Redis documentation:
- Vector indexes overview: https://redis.io/docs/latest/develop/ai/search-and-query/vectors/
- SVS-VAMANA reference and parameters: https://redis.io/docs/latest/develop/ai/search-and-query/vectors/#svs-vamana-index
- SVS compression and tuning options: https://redis.io/docs/latest/develop/ai/search-and-query/vectors/svs-compression/
- SVS-VAMANA perf comparison: https://redis.io/blog/tech-dive-comprehensive-compression-leveraging-quantization-and-dimensionality-reduction/

Changing index settings can require additional RAM and storage for the vector database, since new indexes may be created before old ones are removed. This operation might be time-consuming for large datasets.

Ensure the Redis instances have enough resources assigned, both from compute and storage. Set this in `env/<name>/config.erag.yaml`. The top-level keys are flat; only the per-store payload under `vector_databases_stores` is nested, because the chart consumes it shaped that way:

```yaml
vector_databases_enabled: true
vector_databases_namespace: vdb
vector_databases_vector_store: redis-cluster
vector_databases_stores:
  redis-cluster:
    persistence:
      size: "30Gi"
    resources:
      requests:
        cpu: 8
        memory: 16Gi
      limits:
        cpu: 16
        memory: 128Gi
```

> [!IMPORTANT]
> Overriding `vector_databases_stores` replaces the whole dict, because `-e @file` shallow-merges. Copy the store's block from `deployment/roles/app_vector_databases/defaults/main.yaml` and edit it, rather than supplying only the keys you want to change.

In case of `redis-cluster`, all above settings are applied for each cluster node.

## Model Server Scaling

Model servers (LLM, embedding, reranking) are deployed by the **inference layer** via `model-manager`, not in the RAG pipeline namespace. Their sizing is set in the model catalog (`env/<name>/models-rag.yaml` or `models.yaml`), not in pipeline resource files.

**Automatic Configuration** (default): With `inference_auto_size: true`, the installer probes the topology of every node (physical cores, NUMA nodes, memory) and overrides the catalog `cpu`, `memory`, and `replicas` values with NUMA-aware ones. Manual configuration is only required when `inference_auto_size: false` is set in `env/<name>/config.erag.yaml`.

**Manual Configuration:**

Edit the model entry in the catalog (`env/<name>/models-rag.yaml`), then redeploy with `./model-manager deploy <name> --wait`.

- For machines with ≤64 physical cores per socket: use 1 replica per socket
- For machines with >64 physical cores per socket (e.g., 96 or 128): use 2 replicas per socket

```yaml
# Example for a 2-socket system with ≤64 cores per socket
models:
  - name: llama3-8b-awq
    model_id: casperhansen/llama-3-8b-instruct-awq
    category: llm
    cpu: 32
    memory: 64Gi
    replicas: 2  # 1 replica per socket × 2 sockets
```

If your machine has less than 32 physical cores per NUMA node, reduce the number of CPU cores per replica so that a replica still fits within a single NUMA node:

```yaml
# Example for system with only 24 cores per NUMA node
models:
  - name: llama3-8b-awq
    model_id: casperhansen/llama-3-8b-instruct-awq
    category: llm
    cpu: 24
    memory: 64Gi
    replicas: 1
```

`inference_throughput_mode: true` (the default) favors more replicas at a lower per-replica core count, while `false` favors one large replica per NUMA node. It applies only when automatic sizing is enabled.

**Performance Tip**: Consider enabling Sub-NUMA Clustering (SNC) in BIOS for better inference performance. This helps optimize memory access patterns across NUMA nodes.

## Pipeline Microservice Scaling

When running more than one vLLM instance and the system is accessed by 64+ concurrent users, use at least 2 replicas of `llm-usvc`.

Per-step CPU/memory/replica/HPA settings live in `deployment/pipelines/_shared/steps/<id>.yaml.j2` under a `resources:` block keyed `<name>-usvc`. These are aggregated by `deployment/scripts/compose_pipeline.py` when the pipeline is deployed.

To override a step's resources for your environment, add an override in `env/<name>/config.erag.yaml`:

```yaml
# Example: override llm-usvc resources
llm_usvc:
  replicas: 2
  resources:
    requests:
      cpu: 1
      memory: 2Gi
    limits:
      cpu: 4
      memory: 6Gi
```

See `deployment/scripts/calculate_replicas.py` for the replica calculation logic.

## Runtime Parameter Tuning

Adjust microservice parameters (e.g., `top_k` for reranker, `k` for retriever, `max_new_tokens` for LLM) using one of these methods:

1. **Using the Admin Panel UI:**
   - Navigate to the **Admin Panel** section in the UI and open the **Control Plane** tab.
   - From the pipeline graph, select a service (e.g., LLM, reranker, retriever) to view and edit its parameters in the right-hand pane.
   - For detailed, step-by-step instructions with screenshots, see the **Control Plane** section of the user guide for your app:
     - [AudioQnA User Guide](../Intel_AI_for_Enterprise_RAG_AudioQnA_User_Guide.pdf)
     - [ChatQnA User Guide](../Intel_AI_for_Enterprise_RAG_ChatQnA_User_Guide.pdf)
     - [DocSum User Guide](../Intel_AI_for_Enterprise_RAG_DocSum_User_Guide.pdf)

2. **Using Configuration Scripts:**
   - See [benchmark helpers](../../src/tests/e2e/benchmarks/chatqna/README.md) for test and configuration scripts.

Only parameters that don't require a microservice restart can be adjusted at runtime.

## Horizontal Pod Autoscaling

Enable HPA to allow the system to dynamically scale required resources in the cluster. HPA can be enabled in `env/<name>/config.erag.yaml`:

```yaml
hpa_enabled: true
```

See [HPA component](../../deployment/components/hpa/README.md).

## CPU Pinning (NRI Balloons)

CPU pinning for inference pods (vLLM, embedding, reranking) is crucial for performance and is controlled by the **platform layer**, not this application layer.

Set `kubernetes_cpu_policy` in `env/<name>/global_config.yaml` (platform config, not RAG config):

```yaml
kubernetes_cpu_policy: nri-balloons  # Options: nri-balloons | kubelet-static | best-effort
```

`nri-balloons` (default) provides NUMA-aware pinning via the NRI plugin. The installer generates per-node `BalloonsPolicy` CRs based on the topology.

For configuration details see [NRI CPU Balloons](https://github.com/intel/enterprise-ai-solutions/blob/main/docs/customize/nri_cpu_balloons.md) in Enterprise AI Solutions docs.

## Monitoring and Validation

After making performance tuning changes, monitor system performance using:
- The built-in Grafana dashboards (see [Telemetry](telemetry.md))
- Load testing with sample queries (see `deployment/scripts/test_connection.sh`)
- Memory and CPU utilization metrics

This will help validate that your changes have had the desired effect.
