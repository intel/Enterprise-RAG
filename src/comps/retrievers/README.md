# Retriever Microservice

Retirever searches and retrieves relevant information, documents or data from a database based on a given embedding query. It uses vector search provided by the selected database and performs a query. The query algorithm and configuration should be included in the request to this microservice.

This service internally uses VectorStore class which has to be appropriately configureds. For more information on selecting proper vector database and usage please refer to [VectorStore documentation](../vectorstores/README.md).

## Table of Contents

1. [Retriever Microservice](#retriever-microservice)
2. [Configuration Options](#configuration-options)
   - 2.1. [Vector Store Support Matrix](#vector-store-support-matrix)
3. [Getting Started](#getting-started)
   - 3.1. [Prerequisites](#prerequisites)
   - 3.2. [🚀 Start Retriever Microservice with Python (Option 1)](#-start-retriever-microservice-with-python-option-1)
     - 3.2.1. [Install Requirements](#install-requirements)
     - 3.2.2. [Start Microservice](#start-microservice)
   - 3.3. [🚀 Start Retriever Microservice with Docker (Option 2)](#-start-retriever-microservice-with-docker-option-2)
     - 3.3.1. [Build the Docker service](#build-the-docker-service)
     - 3.3.2. [Run the Docker container](#run-the-docker-container)
   - 3.4. [Example input](#example-input)
     - 3.4.1. [Query parameters](#query-parameters)
   - 3.5. [Example output](#example-output)
4. [Additional Information](#additional-information)
   - 4.1. [Hybrid Search: contextual BM25 + contextual embeddings](#hybrid-search-contextual-bm25--contextual-embeddings)
   - 4.2. [Metadata-Aware Query Filtering](#metadata-aware-query-filtering)
   - 4.3. [Project Structure](#project-structure)

## Configuration options

Configuration is done by selecting the desired vector store type. In addition, the specific vector store endpoint connections settings have to be passed.  For more information on selecting proper vector database and usage please refer to [VectorStore documentation](../vectorstores/README.md).

| Environment Variable    | Default Value     | Description                                                                                      |
|-------------------------|-------------------|--------------------------------------------------------------------------------------------------|
| `VECTOR_STORE`          | `redis`           | Vector Store database type                                                                       |
| `RETRIEVER_USVC_PORT`          | `6620`           | (Optional) Retriever microservice port         |
| `METADATA_EXTRACTION_MODE` | `off`      | Metadata extraction mode: `off` (default), `regex_only`, `hybrid`, `ner_only` (see [OVMS NER](impl/model_server/ovms/README.md)) |
| `HYBRID_SEARCH_ENABLED` | `False` | Serve `similarity` requests as [hybrid search](#hybrid-search-contextual-bm25--contextual-embeddings) (BM25 + dense vector, fused with RRF). Redis only |
| `HYBRID_SEARCH_CANDIDATE_K` | `100` | Candidates fetched from EACH leg before fusion |
| `HYBRID_SEARCH_RESULT_K` | `20` | Depth of the fused list passed to the reranker |
| `HYBRID_SEARCH_RRF_K` | `0` | RRF rank-smoothing constant (`0` = Anthropic's `weight / rank`) |
| `HYBRID_SEARCH_SEMANTIC_WEIGHT` | `0.8` | Fusion weight of the dense vector leg |
| `HYBRID_SEARCH_BM25_WEIGHT` | `0.2` | Fusion weight of the lexical BM25 leg |

### Vector Store Support Matrix

Support for specific vector databases:

| Vector Database                                          |  Status   |
| -------------------------------------------------------- | --------- |
| [REDIS](../vectorstores/README.md#redis)                 | &#x2713;  |
| [REDIS-CLUSTER](../vectorstores/README.md#redis-cluster) | &#x2713;  |

## Getting started

There're 2 ways to run this microservice:
  - [via Python](#-start-retriever-microservice-with-python-option-1)
  - [via Docker](#-start-retriever-microservice-with-docker-option-2) **(recommended)**

Since this service is utilizing VectorStore code, you have to configure the underlying implementation by setting an env variable `VECTOR_STORE` along with vector database configuration for the selected endpoint.

### Prerequisites

To run this microservice, a vector database should be already running. To run one of the [supported vector](#vector-store-support-matrix) databases you can use sample docker-compose files [located here](../vectorstores/impl/).

### 🚀 Start Retriever Microservice with Python (Option 1)

#### Install Requirements
To freeze the dependencies of a particular microservice, [uv](https://github.com/astral-sh/uv) project manager is utilized. So before installing the dependencies, installing uv is required.
Next, use `uv sync` to install the dependencies. This command will create a virtual environment.

```bash
pip install uv
uv sync --locked --no-cache --project impl/microservice/pyproject.toml
source impl/microservice/.venv/bin/activate
```

#### Start Microservice

```bash
python erag_retriever_microservice.py
```
This sample assumes redis as a vector store database. You can run it by [following this documentation](../vectorstores/README.md#redis).

### 🚀 Start Retriever Microservice with Docker (Option 2)

Using a container is a preferred way to run the microservice.

#### Build the Docker service

Navigate to the `src` directory and use the docker build command to create the image:

```bash
cd ../.. # src/ directory
docker build -t erag/retriever:latest -f comps/retrievers/impl/microservice/Dockerfile .
```

#### Run the Docker container

Remember, you can pass configuration variables by passing them via `-e` option into docker run command, such as the vector database configuration and database endpoint.

```bash
docker run -d --name=retriever --network=host --ipc=host --env-file comps/retrievers/impl/microservice/.env erag/retriever:latest
```

### Example input

Retriever microservice as an input accepts a json. The input is required to have an already embedded text query along with query configuration type and parameters.

#### Query parameters

- `text` - contains the text in human readable format that embeddings array was formed from
- `embeddings` - contiants an embedding vector for a query
- `search_type` - configures the type of search algorithm used by the database (default: `similarity`)

Based on the selected `search_type` method, additional arguments should be passed:

| Search type                      | Search method                             | Arguments                     |
| -------------------------------- | ----------------------------------------- | ----------------------------- |
| `similarity`                     | `similarity_search_by_vector`             | `k`                           |
| `vector`                         | `similarity_search_by_vector`             | `k` (never upgraded to hybrid) |
| `hybrid`                         | `hybrid_search_by_vector`                 | `k`, `hybrid_candidate_k`, `hybrid_result_k`, `rrf_k`, `semantic_weight`, `bm25_weight` |
| `similarity_distance_threshold`  | `similarity_search_by_vector`             | `k`, `distance_threshold`     |
| `similarity_search_with_siblings` | `similarity_search_with_siblings`       | `k`, `distance_threshold`     |

Additional search parameters that can be added to the query to configure the search:
- `k`: The number of nearest neighbors to retrieve from the database. It determines the size of the result set (default: `10`)
- `distance_treshold`: The maximum distance threshold for similarity search by vector. Documents with a distance greater than the threshold will not be considered as matches. The default value is not specified. (default: `None`)

An example request can look as follows:

```bash
  curl -v http://localhost:6620/v1/retrieval \
    -X POST \
    -d '{ "text": "What is Intel AVX-512?", "embedding": [0.024471128, 0.047724035, -0.02704641, 0.0013827643], "search_type": "similarity" }' \
    -H 'Content-Type: application/json'
```

Alternatively, you can pass multiple docs but this will limit the retrieval only to the first element.

```bash
  curl http://localhost:6620/v1/retrieval \
    -X POST \
    -d '{ "docs": [ { "text": "What is Intel AVX-512?", "embedding": [0.024471128, 0.047724035, -0.02704641, 0.0013827643], "search_type": "similarity" } ] }' \
    -H 'Content-Type: application/json'
```

### Example output

```bash
  {
    "retrieved_docs": [...],
    "initial_query": "What is Intel AVX-512?",
    "top_n": 1
  }
```

## Additional Information

### Hybrid Search: contextual BM25 + contextual embeddings

The retriever can run two retrievers over the same chunks and fuse their rankings before
the reranker sees them, which is the query-time half of
[Anthropic's Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval):

1. **Contextual embeddings leg** — dense vector search (`similarity_search_by_vector`).
2. **Contextual BM25 leg** — lexical full-text search over the same indexed chunk text
   (RediSearch `BM25STD`). When [contextual RAG](../contextual_rag/README.md) is enabled,
   that text is `context blurb + chunk`, so this leg is contextual BM25 rather than plain BM25.
3. **Weighted Reciprocal Rank Fusion** — each leg returns `hybrid_candidate_k` candidates and a
   document at rank *r* in a leg contributes `weight / (rrf_k + r)` to its fused score. Only
   ranks are fused, so cosine distance and BM25 scores never have to be normalised against
   each other. The top `hybrid_result_k` fused chunks go to the reranker, which cuts them to `top_n`.

Anthropic report 35% fewer retrieval failures for contextual embeddings alone, 49% once
contextual BM25 and rank fusion are added, and 67% with reranking on top — so all three
stages are needed to reach the headline figure.

Measured on a reference CPU deployment (MultiHop-RAG, 500 randomly sampled queries, identical
index, only hybrid search flipped, at `hybrid_candidate_k=150` / `hybrid_result_k=50`):
**Hits@10 0.702 → 0.808, MAP@10 0.243 → 0.288, retrieval failures 29.8% → 19.2%** (−35.6%
relative; **−48.4%** against a non-contextual baseline, matching the 49% Anthropic report for
these two stages). Paired per query it fixes 74 and breaks 21 (exact McNemar p = 4.3e-08). The
gain is bigger *after* reranking than before it, because fusion hands the reranker
`hybrid_result_k` candidates instead of `k` (10): given only 10 the reranker can merely reorder
and drops gold chunks out of the top 10 more often than it lifts them in, so its own
contribution to Hits@10 goes from **−0.038 to +0.024** and its `gain_MAP@10` nearly doubles.
Cost at those depths: about +1 s per query, most of it the reranker scoring 50 chunks instead
of 10, and nothing at ingest time. The shipped defaults are shallower (100 / 20) for a cheaper
query; set 150 / 50 to reproduce the measurement above. Full measurement methodology:
[contextual_RAG_integration.md](../../../contextual_RAG_integration.md).

Hybrid search is **enabled by default whenever contextual RAG is enabled** (the deployment
sets `HYBRID_SEARCH_ENABLED=True`); see `edp_contextual_rag_hybrid_search_enabled` in
[deployment/pipelines/chatqna/config.yaml](../../../deployment/pipelines/chatqna/config.yaml).
It requires a Redis/Redis-cluster vector store, because the fusion relies on RediSearch's
full-text index over the chunk text. No re-ingest or schema change is needed — the `text`
field is already indexed as `TEXT`.

**Per-request overrides.** `HYBRID_SEARCH_*` values are only defaults: any parameter sent in
the request wins. Two escape hatches:

- `"search_type": "vector"` — force dense-only retrieval even where hybrid is enabled.
- `"search_type": "hybrid"` — force hybrid retrieval even where the flag is off.

```bash
  curl -v http://localhost:6620/v1/retrieval \
    -X POST \
    -d '{ "text": "What is Intel AVX-512?", "embedding": [0.024471128, 0.047724035], "search_type": "hybrid", "k": 10, "hybrid_candidate_k": 100, "semantic_weight": 0.8, "bm25_weight": 0.2, "rrf_k": 0 }' \
    -H 'Content-Type: application/json'
```

Every returned chunk carries provenance in its metadata: `rrf_score`, `retrieval_source`
(`hybrid` / `vector` / `bm25`), `vector_rank`, `bm25_rank` and `bm25_score`. A chunk found
only by the BM25 leg has **no** `vector_distance`, so downstream consumers must read
`rrf_score` instead (the reranker already does).

> [!NOTE]
> `rrf_k` defaults to `0`, i.e. Anthropic's `weight / rank`, not the canonical RRF constant
> of 60. With 60 and the reference 0.8/0.2 weighting the lexical leg becomes inert — the best
> possible BM25-only score (`0.2/61`) loses to the *worst* dense score in a 100-candidate
> pool (`0.8/160`), so hybrid search would silently degrade to dense-only. Use `rrf_k: 60`
> only together with balanced weights (0.5/0.5).

Behaviour under failure: the legs are issued concurrently, and the dense leg is
authoritative. If the BM25 leg fails, or the query consists entirely of stopwords, retrieval
degrades to dense-only instead of failing the request. Non-Redis vector stores raise
`NotImplementedError`, which the microservice returns as HTTP 501.

### Metadata-Aware Query Filtering

The retriever supports metadata-aware query filtering, which extracts structured metadata (authors, dates, document titles) from natural language queries and applies them as filters during vector search. This feature is **enabled by default** in **hybrid** mode (regex + NER). If the NER OVMS container is not deployed, the retriever falls back to regex-only extraction automatically.

> [!IMPORTANT]
> The OVMS NER server under `impl/model_server/ovms/` is **not** a local-testing harness:
> it is a deployed Intel AI for Enterprise RAG component that serves a token-classification
> model alongside the retriever. Chat, embedding and reranking models come from Intel AI for
> Enterprise Solutions through Enterprise Inference (Model Manager), but the NER model has no
> Model Manager equivalent, so this repository owns its image and its deployment. The
> docker-compose setup below is the local equivalent of that deployed component.

See the [OVMS NER README](impl/model_server/ovms/README.md) for NER model server setup and docker-compose configuration.

**Retriever metadata settings** (set in [impl/microservice/.env](impl/microservice/.env)):

| Variable | Default | Description |
|----------|---------|-------------|
| `METADATA_EXTRACTION_MODE` | `off` | Metadata extraction mode: `off` (disabled), `regex_only`, `hybrid` (regex+NER), or `ner_only` |
| `METADATA_LANGUAGE` | `en` | Language for regex patterns and name lemmatization (`en` or `pl`) |
| `NER_ENDPOINT` | _(unset)_ | URL of the NER OVMS Gateway. Required for `hybrid` and `ner_only` modes |

> [!NOTE]
> If the NER OVMS container is not running, the retriever falls back to regex-only mode automatically. To disable metadata filtering entirely, set `METADATA_EXTRACTION_MODE=off` (this is the default).

#### NER Endpoint Behavior

| Scenario | `NER_ENDPOINT` | Behavior | Log Level |
|----------|---------------|----------|-----------|
| **Not defined** | _(unset)_ | Regex-only extraction, NER skipped entirely | `INFO`: _"NER disabled (NER_ENDPOINT not set), using regex-only mode"_ |
| **Defined but unreachable** | `http://...:9001` (container down) | First request falls back to regex-only with guidance; subsequent failures logged at DEBUG | `INFO` (first): _"NER endpoint unreachable … Check that retriever-ner-ovms container is running"_ |
| **Defined and reachable** | `http://...:9001` (healthy) | Hybrid extraction: regex + NER merge | `INFO`: _"NERExtractor initialized: endpoint=…"_ |

### Project Structure

The project is organized into several directories:

- `impl/`: This directory contains the implementation of the Retriever service.

- `utils/`: This directory contains scripts that are used by the Retriever Microservice.
