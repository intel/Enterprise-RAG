# Model Configuration

[← Customize](../README.md#customize)

Intel® AI for Enterprise RAG supports multiple models for LLM inference, text embedding, and reranking, including multilingual models for non-English deployments.

## How models are declared

Models are selected in `env/<name>/config.erag.yaml` through the `inference_models` list. Each entry references a model by its catalog name and assigns it a role:

```yaml
inference_models:
  - name: llama3-8b-awq
    role: llm
  - name: nomic-embed
    role: embedding
  - name: bge-reranker-v2-m3
    role: reranking
```

The catalog name is the `name:` field of an entry in `env/<name>/models-rag.yaml`. That file is seeded from `deployment/models.yaml` on first install, and operator edits to the environment copy survive re-runs.

**Add a model not in the catalog:**

1. Edit `env/<name>/models-rag.yaml`
2. Add an entry with `name` + `model_id` (the Hugging Face repo)
3. Reference the new name in `inference_models`

## Changing models

Edit `env/<name>/config.erag.yaml` and re-run:

```bash
./es_auto_installer.sh install erag --env <name>
```

The installer automatically:

- Undeploys models that were previously running but are no longer in `inference_models`
- Deploys new models that are in `inference_models` but not yet running
- Downloads weights to the shared `model-store` PVC (skipped if already present)
- Derives serving endpoints dynamically (`<role>_model_name`, `<role>_model_id`, `<role>_endpoint`)
- Waits for each model to report ready

Weights are never deleted, so switching back to a model you previously used skips the download.

### What changes the embedding model

Changing the embedding model changes the vector dimensions and invalidates the existing index. After the model change:

1. The new model deploys with updated dimensions
2. Existing documents remain in the vector store but were embedded with the old model
3. Re-ingest all documents through the Admin Panel → Data Ingestion to rebuild the index

`vector_databases_vector_dims` is auto-detected from the new `embedding_model_id`; set it explicitly only when the model is unknown to the lookup table and the Hugging Face Hub is unreachable.

### Replica sizing

LLM replica count and CPU allocation are calculated to fit the LLM, embedding, and reranking models together inside one NUMA node. Changing any model's size may affect the replica count of all three.

Only models labeled `app.kubernetes.io/part-of=erag` are managed by the installer. Models deployed by hand or by the inference layer are left alone.

## Model catalog reference

Default models for RAG Chatqna pipeline:

| Role | Catalog name | Model ID | Language |
|------|-------------|----------|----------|
| LLM | `llama3-8b-awq` | `casperhansen/llama-3-8b-instruct-awq` | English |
| Embedding | `nomic-embed` | `nomic-ai/nomic-embed-text-v1.5` | English |
| Reranking | `bge-reranker-v2-m3` | `BAAI/bge-reranker-v2-m3` | Multi-language |


Multilingual recommended:

| Role | Catalog name | Model ID | Languages |
|------|-------------|----------|-----------|
| Embedding | `multilingual-e5-large` | `intfloat/multilingual-e5-large-instruct` | 100+ |
| Reranking | `bge-reranker-v2-m3` | `BAAI/bge-reranker-v2-m3` | Multi-language |

The full catalog is at `env/<name>/models-rag.yaml`. To see available catalog entries:

```bash
grep "^  - name:" env/<name>/models-rag.yaml
```

Each entry includes CPU/memory sizing, engine, category, and optional per-model args.

## Multilingual deployments

### Prerequisites

- Multilingual embedding and reranking models (see table above)
- An LLM that supports the target language (the catalog includes Polish models; any Hugging Face model can be added)
- All three components must support the target language for end-to-end multilingual RAG

### Configuration

1. Set `solution_language` in `env/<name>/config.erag.yaml`:

   ```yaml
   solution_language: "pl"    # auto | en | pl
   ```

   | Value | Behavior |
   |-------|----------|
   | `auto` (default) | Polish when the LLM name contains "PLLuM" or "Bielik", otherwise English |
   | `en` | Force English prompts |
   | `pl` | Force Polish prompts |

2. Update `inference_models` with multilingual entries:

   ```yaml
   inference_models:
     - name: your-multilingual-llm
       role: llm
     - name: e5-large-instruct
       role: embedding
     - name: bge-reranker-v2-m3
       role: reranking
   ```

3. Deploy:

   ```bash
   ./es_auto_installer.sh install erag --env <name>
   ```

4. Re-ingest all documents so they are embedded with the new multilingual model.

**Prompt templates:** When changing the LLM, verify the prompt template matches the model's training format. Each model's Hugging Face page describes its expected format. Changing the prompt may affect multilingual behavior, as templates are typically written in English.

## Accuracy tuning

Intel AI for Enterprise RAG includes multiple techniques to improve retrieval and answer accuracy.

### Metadata filtering

Extracts structured information (author names, dates, document titles) from natural language queries and uses it to narrow vector search results. Example: *"documents written by John Smith last month"* automatically filters to John Smith's documents from the last month.

| Mode | Requires infrastructure | Description |
|------|------------------------|-------------|
| `off` (default) | No | Disabled |
| `regex_only` | No | Regex pattern matching |
| `hybrid` | Yes (OVMS NER model) | Regex + NER for broader coverage |
| `ner_only` | Yes (OVMS NER model) | NER only (testing) |

Enable at runtime through the Control Plane Admin Panel under Retriever settings, or by editing the retriever `.env` file:

```text
METADATA_EXTRACTION_MODE=regex_only
```

For `hybrid` or `ner_only` mode, enable NER in `env/<name>/config.erag.yaml`:

```yaml
ner:
  enabled: true
```

Then add the `OvmsNer` step to your pipeline after `Retriever` and redeploy.

### Similarity search with siblings

When a chunk is identified as relevant, this method retrieves adjacent chunks (siblings) from the same document, providing more complete context to the LLM.

**Benefits:** enhanced context, improved coherence, reduced fragmentation.

**Drawback:** additional chunks increase LLM processing load, affecting performance under high concurrency.

Enable or adjust at runtime via the Admin Panel by changing the retriever search type to `similarity_search_with_siblings`. No redeployment or re-ingestion required.

See [`src/comps/vectorstores/README.md#search`](../../src/comps/vectorstores/README.md#search) for detailed configuration.

### Late chunking

**Status:** Not supported in this release.

Late chunking embeds full documents before splitting them into chunks, preserving broader contextual meaning. Traditional chunking splits first and then embeds each chunk independently.

**Why it is unavailable:** Late chunking requires token-level embeddings, which the embedding microservice requests with `return_pooling=true`. The only backend that implemented this was the TorchServe embedding server, which is no longer part of Intel AI for Enterprise RAG. Models are now served via Intel AI for Enterprise Solutions (Model Manager), and vLLM does not expose token-level pooling output yet.

A request with `return_pooling=true` is rejected with an error rather than silently returning aggregated vectors, which would produce incorrect embeddings. The `edp_late_chunking_enabled` flag must stay at its default of `false`.

**Alternative:** Use [Similarity Search with Siblings](#similarity-search-with-siblings) to give the LLM broader context around a matched chunk.

Support will return once token-level pooling is available through the Model Manager catalog.

## Accuracy evaluator

Intel AI for Enterprise RAG includes a comprehensive accuracy evaluator for automated end-to-end testing using the MultiHop dataset (2,556 queries). It computes 10+ metrics including:

- Retrieval: Hits@K, MRR, MAP
- Generation: BLEU, ROUGE-L
- RAGAS: Answer Correctness, Faithfulness, Context Precision, Context Recall

For detailed setup and usage, see [`src/tests/e2e/evals/evaluation/rag_eval/README.md`](../../src/tests/e2e/evals/evaluation/rag_eval/README.md).

## Environment variables passed to model-manager

The `app_inference_models` role invokes `./model-manager` with these environment variables set:

| Variable | Purpose |
|----------|---------|
| `HF_TOKEN` | Hugging Face token for gated models (e.g. Llama) |
| `MM_CONFIG` | Path to the model catalog (`env/<name>/models-rag.yaml`) |
| `MM_GLOBAL_CONFIG` | Path to `env/<name>/global_config.yaml` |
| `MM_CPU_POLICY` | Override `kubernetes_cpu_policy` for this invocation |
| `MM_FORCE_REDEPLOY` | `1` - re-apply a model even if its spec is unchanged |

Run `./model-manager --help` for the full list of flags and environment variables.

## Related docs

| Topic | Link |
|-------|------|
| Model catalog structure and runtime settings | [`ext/enterprise.ai-inference/docs/customize/catalog.md`](https://github.com/intel/enterprise-inference/blob/main/docs/customize/catalog.md) |
| Supported serving runtimes (vLLM, OpenVINO) | [`ext/enterprise.ai-inference/docs/customize/runtimes.md`](https://github.com/intel/enterprise-inference/blob/main/docs/customize/runtimes.md) |
| Performance tuning and sizing | [`../operate/performance.md`](../operate/performance.md) |
| Pipeline variants and flavours | [`../deploy/pipelines.md`](../deploy/pipelines.md) |
