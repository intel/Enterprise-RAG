# Intel® AI for Enterprise RAG Contextual RAG Service

Part of the Intel® AI for Enterprise RAG (ERAG) ecosystem.

## Overview

The Intel® AI for Enterprise RAG Contextual RAG Microservice implements Anthropic's
[Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval): for
every chunk of a document, an LLM writes a short blurb that situates that chunk within
its parent document, and the blurb is prepended to the chunk before it is embedded and
indexed. Chunks stop being anonymous fragments, so both dense retrieval and lexical BM25
match them far more reliably.

One request carries the chunks of exactly one source document plus that document's full
text. The document is sent whole and forms a shared prompt prefix, so a prefix-caching
model server computes its KV cache once per document instead of once per chunk; the first
chunk warms the cache and the rest are fanned out behind it, all pinned to the same
replica. Documents are never truncated: one for which any chunk's blurb request (the prompt plus
MAX_NEW_TOKENS for the blurb) does not fit the token budget (CONTEXT_MAX_PROMPT_TOKENS,
default 16384) is passed through without blurbs.

## 🔗 Related Components

This service works within the Intel® AI for Enterprise RAG ecosystem:
- Enhanced Data Preparation (EDP) calls this service between chunking and ingestion
- A dedicated blurb model (in a deployment `RedHatAI/Qwen3-4B-Instruct-2507-quantized.w8a8`; any OpenAI-compatible vLLM endpoint works)
- Retriever service, which fuses contextual BM25 with contextual embedding search

## License
Intel® AI for Enterprise RAG is licensed under the Apache License, Version 2.0.

Copyright © 2024–2026 Intel Corporation. All rights reserved.
