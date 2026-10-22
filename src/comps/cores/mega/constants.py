# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

from enum import Enum


class ServiceType(Enum):
    """The enum of a service type."""

    EMBEDDING = 1
    RETRIEVER = 2
    RERANK = 3
    LLM = 4
    ASR = 5
    TTS = 6
    UNDEFINED = 10
    LLM_GUARD_INPUT_SCANNER = 15
    LLM_GUARD_OUTPUT_SCANNER = 16
    INGESTION = 17
    LANGUAGE_DETECTION = 18
    PROMPT_TEMPLATE = 19
    LLM_GUARD_DATAPREP_SCANNER = 20
    TEXT_EXTRACTOR = 21
    TEXT_COMPRESSION = 22
    TEXT_SPLITTER = 23
    CHAT_HISTORY = 24
    DOC_SUMMARY = 34
    LATE_CHUNKING = 35
    NAMESPACE_STATUS_WATCHER = 36
    QUERY_REWRITE = 37
    CONTEXTUAL_RAG = 38


class MegaServiceEndpoint(Enum):
    """The enum of an MegaService endpoint."""

    DOC_SUMMARY = "/v1/docsum"
    LANGUAGE_DETECTION = "/v1/language_detection"
    EMBEDDINGS = "/v1/embeddings"
    TTS = "/v1/audio/speech"
    ASR = "/v1/audio/transcriptions"
    CHAT = "/v1/chat/completions"
    CHAT_MODELS = "/v1/models"
    RETRIEVAL = "/v1/retrieval"
    RERANKING = "/v1/reranking"
    PROMPT_TEMPLATE = "/v1/prompt_template"
    LLM_GUARD_INPUT_SCANNER = "/v1/llmguardinput"
    LLM_GUARD_OUTPUT_SCANNER = "/v1/llmguardoutput"
    INGEST = "/v1/ingestion"
    SYSTEM_FINGERPRINT = '/v1/system_fingerprint'
    LLM_GUARD_DATAPREP_SCANNER = "/v1/llmguarddataprep"
    TEXT_EXTRACTOR = "/v1/text_extractor"
    TEXT_COMPRESSION = "/v1/text_compression"
    TEXT_SPLITTER = "/v1/text_splitter"
    CHAT_HISTORY = "/v1/chat_history"
    LATE_CHUNKING = "/v1/late_chunking"
    QUERY_REWRITE = "/v1/query_rewrite"
    CONTEXTUAL_RAG = "/v1/contextual_rag"

    def __str__(self):
        return self.value


