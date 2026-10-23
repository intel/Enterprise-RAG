# Reranking Microservice

The Reranking Microservice, fueled by reranking models, stands as a straightforward yet immensely potent tool for semantic search. When provided with a query and a collection of documents, reranking swiftly indexes the documents based on their semantic relevance to the query, arranging them from most to least pertinent. This microservice significantly enhances overall accuracy. In a text retrieval system, either a dense embedding model or a sparse lexical search index is often employed to retrieve relevant text documents based on the input. However, a reranking model can further refine this process by rearranging potential candidates into a final, optimized order.

## Table of Contents

1. [Reranking Microservice](#reranking-microservice)
2. [Support Matrix](#support-matrix)
3. [Configuration Options](#configuration-options)
4. [Getting Started](#getting-started)
   - 4.1. [Prerequisite: Start Reranking Model Server](#prerequisite-start-reranking-model-server)
   - 4.2. [🚀 Start Reranking Microservice with Python (Option 1)](#-start-reranking-microservice-with-python-option-1)
     - 4.2.1. [Install Requirements](#install-requirements)
     - 4.2.2. [Start Microservice](#start-microservice)
   - 4.3. [🚀 Start Retranking Microservice with Docker (Option 2)](#-start-retranking-microservice-with-docker-option-2)
     - 4.3.1. [Build the Docker Image](#build-the-docker-image)
     - 4.3.2. [Run the Docker Container](#run-the-docker-container)
   - 4.4. [Verify the Reranking Microservice](#verify-the-reranking-microservice)
     - 4.4.1. [Check Status](#check-status)
     - 4.4.2. [Sending a Request](#sending-a-request)
       - 4.4.2.1. [Example Input](#example-input)
       - 4.4.2.2. [Example Output](#example-output)
5. [Additional Information](#additional-information)
   - 5.1. [Project Structure](#project-structure)
     - 5.1.1. [Tests](#tests)

## Support matrix

Model servers the reranking connector can talk to.

| Model server name                 |  Status   |
| --------------------------------- | --------- |
| [VLLM](./impl/model_server/vllm/) | &#x2713;  |
| OVMS                              | &#x2717;  |

> [!NOTE]
> `nai` (Nutanix Enterprise AI, Cohere-style `/rerank` API) is also a supported remote
> endpoint. It is an externally hosted service, so there is no in-tree setup for it.


## Configuration Options

The configuration for the Reranking Microservice is specified in the [impl/microservice/.env](impl/microservice/.env) file. You can adjust these settings by modifing this dotenv file or by exporting environment variables.

| Environment Variable        | Description                                                                |
|-----------------------------|----------------------------------------------------------------------------|
| `RERANKING_USVC_PORT`       | The port of the microservice, by default 8000                              |
| `RERANKING_SERVICE_ENDPOINT`     | The endpoint of the reranking service, e.g., "http://localhost:6060" |
| `RERANKING_MODEL_SERVER`     | Connector used to reach the model server: "vllm" or "nai" (Nutanix Enterprise AI rerank endpoint) |
| `RERANKING_LATE_CHUNKING_ENABLED` | Flag informing if the late chunking is enabled. Default: False |

Set below environment variables only for VLLM if remote model server is enabled with token based authentication (OAuth).
| `RERANKING_VLLM_CLIENT_ID`                 | The client id in auth provider |
| `RERANKING_VLLM_CLIENT_SECRET`             | The secret of the client in auth provider |
| `RERANKING_VLLM_TOKEN_URL`                 | The token URL to get the access token |

Alternatively, static API KEY can be provided. This will override OAuth settings.
| `RERANKING_VLLM_API_KEY` | static API key for vllm endpoint |


## Getting started

There're 2 ways to run this microservice:
  - [via Python](#-start-reranking-microservice-with-python-option-1)
  - [via Docker](#-start-retranking-microservice-with-docker-option-2) **(recommended)**

> [!IMPORTANT]
> The model server setups under `impl/model_server/` are for **local development and
> testing only**. In an Intel AI for Enterprise RAG deployment, model servers are not
> part of this repository: Intel AI for Enterprise Solutions deploys every model
> through Enterprise Inference (Model Manager) **before** the RAG components start,
> and this microservice only consumes the endpoint it is given. Use the harness here
> when you need an endpoint to test the microservice standalone; do not use it as a
> deployment reference.

### Prerequisite: Start Reranking Model Server
The Reranking Microservice interacts with a rerank model endpoint, which must be operational and accessible at the the URL specified by the `RERANKING_SERVICE_ENDPOINT` env.

Follow the instructions in the [impl/model_server/vllm](impl/model_server/vllm/) directory to set up and start the service locally.

### 🚀 Start Reranking Microservice with Python (Option 1)

To start the Reranking microservice, you need to install python packages first.

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
python erag_reranking_microservice.py
```

### 🚀 Start Retranking Microservice with Docker (Option 2)

#### Build the Docker Image
Navigate to the `src` directory and use the docker build command to create the image:
```bash
cd ../../
docker build -t erag/reranking:latest -f comps/reranks/impl/microservice/Dockerfile .
```
Please note that the building process may take a while to complete.

#### Run the Docker Container
```bash
docker run -d --name="reranking-microservice" \
  --net=host \
  --ipc=host \
  erag/reranking:latest
```

If the model server is running at a different URL than the default, update the `RERANKING_SERVICE_ENDPOINT` variable accordingly. Here's an example of how to pass configuration using the docker run command:

```bash
docker run -d --name="reranking-microservice" \
  -e RERANKING_SERVICE_ENDPOINT=http://localhost:6060 \
  --net=host \
  --ipc=host \
  erag/reranking:latest
```

### Verify the Reranking Microservice

#### Check Status

```bash
curl http://localhost:8000/v1/health_check \
  -X GET \
  -H 'Content-Type: application/json'
```

#### Sending a Request

The `top_n` parameter allows you to specify the number of results returned by the reranker model. By default, the reranker returns the top five results (top_n=5). Adding the top_n parameter enables you to retrieve a different number of ranked results, with the option to adjust it as needed.

Additionally, you can pass `rerank_score_threshold` to filter received docs based on the model output. Reranking model returns a similarity distance that is mapped to a float value between 0 and 1 using a sigmoid function. For reranker the higher value, the better similarity to the prompt. If rerank_score_threshold is defined, the microservice will ignore all chunks that returned a score equal or lower than this value.

##### Example Input

```bash
curl http://localhost:8000/v1/reranking \
  -X POST \
  -d '{"user_prompt":"What is Deep Learning?", "retrieved_docs": [{"text":"Deep Learning is not..."}, {"text":"Deep learning is..."}], "top_n":1, "rerank_score_threshold": 0.02}' \
  -H 'Content-Type: application/json'
```

##### Example Output

The reranking microservice outputs a JSON containing the original user question and a list of relevant documents based on reranked top_n results.
```json
{
  "id": "d5d4102b8dc9414866d9c2ee550c9229",
  "data": {
    "user_prompt": "What is Deep Learning?",
    "reranked_docs": [
      {
        "downstream_black_list": [],
        "id": "22c8b1d78b34945003101708494a24b6",
        "text": "Deep learning is...",
        "metadata": {
          "vector_distance": 0.23,
          "reranker_score": 0.82,
          "citation_id": 1
        }
      }
    ]
  },
  "prompt_template": null
}
```

## Additional Information

### Documents produced by hybrid search

When the retriever runs [hybrid search](../retrievers/README.md#hybrid-search-contextual-bm25--contextual-embeddings),
the documents it sends here carry an `rrf_score` (higher is better) instead of a directly
comparable `vector_distance`; a chunk that only the BM25 leg found has no vector distance
at all. This matters in two places:

- **Normal operation.** The reranker scores `(user_prompt, chunk_text)` pairs, so retrieval
  scores are irrelevant and hybrid results need no special handling. This is the path that
  produces Anthropic's 67% failure reduction: the retriever hands over a fused list deeper
  than `k` (`hybrid_result_k`, default 20) and the reranker cuts it to `top_n` (default 5).
- **Late chunking (`RERANKING_LATE_CHUNKING_ENABLED=true`).** The reranker model is bypassed
  and documents are ordered by their retrieval score. `_filter_top_n_by_vector_distance()`
  therefore prefers `rrf_score` (negated, so the same ascending sort applies) and falls back
  to `vector_distance` only for documents that were not produced by fusion.

Hybrid metadata (`rrf_score`, `retrieval_source`, `vector_rank`, `bm25_rank`, `bm25_score`)
is passed through untouched alongside `reranker_score`.

### Project Structure

The project is organized into several directories:

- `impl/`: This directory contains the implementation of the supported reranking service. It includes the `model_server` directory, which contains instructions for setting up and running a vLLM reranking server locally for testing.

- `utils/`: This directory contains utility scripts and modules that are used by the Reranking Microservice.

#### Tests
- `src/tests/unit/rerankers/`: Contains unit tests for the Reranking Microservice components
