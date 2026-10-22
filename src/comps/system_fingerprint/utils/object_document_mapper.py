# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

from datetime import datetime
from typing import Literal, Optional, List

from pydantic import BaseModel, NonNegativeFloat, NonNegativeInt, PositiveInt


class AnonymizeModel(BaseModel):
    enabled: bool = False
    use_onnx: bool = False
    hidden_names: Optional[List[str]] = None
    allowed_names: Optional[List[str]] = None
    entity_types: Optional[List[str]] = None
    preamble: Optional[str] = None
    regex_patterns: Optional[List[str]] = None
    use_faker: Optional[bool] = False
    recognizer_conf: Optional[str] = None
    threshold: Optional[float] = None
    language: Optional[str] = None


class BanSubstringsModel(BaseModel):
    enabled: bool = False
    substrings: List[str] = ["backdoor", "malware", "virus"]
    match_type: Optional[str] = "str"
    case_sensitive: bool = False
    redact: Optional[bool] = False
    contains_all: Optional[bool] = False


class BanTopicsModel(BaseModel):
    enabled: bool = False
    use_onnx: bool = False
    topics: List[str] = ["violence", "attack", "war"]
    threshold: Optional[float] = 0.6
    model: Optional[str] = None


class CodeModel(BaseModel):
    enabled: bool = False
    use_onnx: bool = False
    languages: List[str] = ["Java", "Python"]
    model: Optional[str] = None
    is_blocked: Optional[bool] = True
    threshold: Optional[float] = 0.5


class InvisibleText(BaseModel):
    enabled: bool = False


class PromptInjectionModel(BaseModel):
    enabled: bool = False
    use_onnx: bool = False
    model: Optional[str] = None
    threshold: Optional[float] = 0.92
    match_type: Optional[str] = "full"


class RegexModel(BaseModel):
    enabled: bool = False
    patterns: List[str] = ["Bearer [A-Za-z0-9-._~+/]+"]
    is_blocked: Optional[bool] = True
    match_type: Optional[str] = "all"
    redact: Optional[bool] = False


class SecretsModel(BaseModel):
    enabled: bool = False
    redact_mode: Optional[str] = "all"


class SentimentModel(BaseModel):
    enabled: bool = False
    threshold: Optional[float] = -0.3
    lexicon: Optional[str] = None


class TokenLimitModel(BaseModel):
    enabled: bool = False
    limit: Optional[int] = 4096
    encoding_name: Optional[str] = "cl100k_base"
    model_name: Optional[str] = None


class ToxicityModel(BaseModel):
    enabled: bool = False
    use_onnx: bool = False
    model: Optional[str] = None
    threshold: Optional[float] = 0.5
    match_type: Optional[str] = "full"


class BiasModel(BaseModel):
    enabled: bool = False
    use_onnx: bool = False
    model: Optional[str] = None
    threshold: Optional[float] = None
    match_type: Optional[str] = None


class DeanonymizeModel(BaseModel):
    enabled: bool = False
    matching_strategy: Optional[str] = None


class JSONModel(BaseModel):
    enabled: bool = False
    required_elements: Optional[int] = None
    repair: Optional[bool] = False


class MaliciousURLsModel(BaseModel):
    enabled: bool = False
    use_onnx: bool = False
    model: Optional[str] = None
    threshold: Optional[float] = None


class NoRefusalModel(BaseModel):
    enabled: bool = False
    use_onnx: bool = False
    model: Optional[str] = None
    threshold: Optional[float] = None
    match_type: Optional[str] = None


class NoRefusalLightModel(BaseModel):
    enabled: bool = False


class ReadingTimeModel(BaseModel):
    enabled: bool = False
    max_time: float = 0.5
    truncate: Optional[bool] = False


class FactualConsistencyModel(BaseModel):
    enabled: bool = False
    use_onnx: bool = False
    model: Optional[str] = None
    minimum_score: Optional[float] = None


class RelevanceModel(BaseModel):
    enabled: bool = False
    use_onnx: bool = False
    model: Optional[str] = None
    threshold: Optional[float] = None


class SensitiveModel(BaseModel):
    enabled: bool = False
    use_onnx: bool = False
    entity_types: Optional[List[str]] = None
    regex_patterns: Optional[List[str]] = None
    redact: Optional[bool] = False
    recognizer_conf: Optional[str] = None
    threshold: Optional[float] = None


class URLReachabilityModel(BaseModel):
    enabled: bool = False
    success_status_codes: Optional[List[int]] = None
    timeout: Optional[int] = None


class LLMGuardInputGuardrailParams(BaseModel):
    anonymize: Optional[AnonymizeModel] = None
    ban_substrings: Optional[BanSubstringsModel] = None
    ban_topics: Optional[BanTopicsModel] = None
    code: Optional[CodeModel] = None
    invisible_text: Optional[InvisibleText] = None
    prompt_injection: Optional[PromptInjectionModel] = None
    regex: Optional[RegexModel] = None
    secrets: Optional[SecretsModel] = None
    sentiment: Optional[SentimentModel] = None
    token_limit: Optional[TokenLimitModel] = None
    toxicity: Optional[ToxicityModel] = None


class LLMGuardOutputGuardrailParams(BaseModel):
    ban_substrings: Optional[BanSubstringsModel] = None
    ban_topics: Optional[BanTopicsModel] = None
    bias: Optional[BiasModel] = None
    code: Optional[CodeModel] = None
    deanonymize: Optional[DeanonymizeModel] = None
    json_scanner: Optional[JSONModel] = None
    malicious_urls: Optional[MaliciousURLsModel] = None
    no_refusal: Optional[NoRefusalModel] = None
    no_refusal_light: Optional[NoRefusalLightModel] = None
    reading_time: Optional[ReadingTimeModel] = None
    factual_consistency: Optional[FactualConsistencyModel] = None
    regex: Optional[RegexModel] = None
    relevance: Optional[RelevanceModel] = None
    sensitive: Optional[SensitiveModel] = None
    sentiment: Optional[SentimentModel] = None
    toxicity: Optional[ToxicityModel] = None
    url_reachability: Optional[URLReachabilityModel] = None


class LLMGuardDataprepGuardrailParams(BaseModel):
    ban_substrings: Optional[BanSubstringsModel] = None
    ban_topics: Optional[BanTopicsModel] = None
    code: Optional[CodeModel] = None
    invisible_text: Optional[InvisibleText] = None
    prompt_injection: Optional[PromptInjectionModel] = None
    regex: Optional[RegexModel] = None
    secrets: Optional[SecretsModel] = None
    sentiment: Optional[SentimentModel] = None
    token_limit: Optional[TokenLimitModel] = None
    toxicity: Optional[ToxicityModel] = None


class PromptTemplateParams(BaseModel):
    system_prompt_template: str
    user_prompt_template: str


class PromptTemplateEnParams(PromptTemplateParams):
    system_prompt_template: str = """### You are a helpful, respectful, and honest assistant to help the user with questions. \
Include corresponding in-text citation IDs at the end of relevant sentences (in the format [1], [2] etc.) only if referring to information from search results. \
Citation IDs are at the beginning of each search result in [n] format. \
Refer to information from conversation history if you think it is relevant to the current question. \
It is important that you only cite search results, not general knowledge or conversation history. \
If not referring directly to search results do not add citation IDs nor any sources. \
Respond with your best knowledge if the information in search results nor in conversation history is not relevant. \
Ignore all information that you think is not relevant to the question. \
If you don't know the answer to a question, please don't share false information.\n\
### Search results:\n\
{reranked_docs}\n\
### Conversation history:\n\
{conversation_history}\n\
"""
    user_prompt_template: str = """### Question: {user_prompt} \n
### Answer:
"""


class PromptTemplatePlParams(PromptTemplateParams):
    system_prompt_template: str = """### Jesteś pomocnym, uprzejmym i uczciwym asystentem, \
który pomaga użytkownikowi w odpowiadaniu na zadane przez użytkownika pytania. \
Odwołuj się do informacji z historii rozmowy, jeśli uznasz, że są one istotne dla bieżącego pytania. \
Odpowiadaj na podstawie swojej najlepszej wiedzy, jeśli informacje z wyników wyszukiwania ani z historii \
rozmowy nie są istotne. Ignoruj wszystkie informacje, które uznasz za nieistotne dla pytania. \
Jeśli nie znasz odpowiedzi na pytanie, nie podawaj fałszywych informacji.\n\
### Wyniki wyszukiwania:\n\
{reranked_docs}\n\
### Historia rozmowy:\n\
{conversation_history}\n\
"""
    user_prompt_template: str = """###Pytanie: {user_prompt}\n###Odpowiedź:"""


class RetrieverParams(BaseModel):
    # "similarity" (dense vector; upgraded to "hybrid" when the retriever runs with
    # HYBRID_SEARCH_ENABLED=true), "vector" (dense only, never upgraded), "hybrid"
    # (BM25 + dense fused with RRF), "similarity_distance_threshold",
    # "similarity_search_with_siblings".
    search_type: str = "similarity"
    k: PositiveInt = 10
    distance_threshold: Optional[float] = None
    fetch_k: PositiveInt = 20
    lambda_mult: NonNegativeFloat = 0.5
    score_threshold: NonNegativeFloat = 0.2
    metadata_extraction_mode: str = "off"
    # Hybrid search knobs (only used when the effective search_type is "hybrid").
    # rrf_k = 0 reproduces Anthropic's weight/rank fusion; 60 is canonical RRF smoothing
    # and only makes sense with balanced semantic/bm25 weights.
    hybrid_candidate_k: PositiveInt = 100
    hybrid_result_k: PositiveInt = 20
    rrf_k: NonNegativeInt = 0
    semantic_weight: NonNegativeFloat = 0.8
    bm25_weight: NonNegativeFloat = 0.2


class RerankerParams(BaseModel):
    top_n: PositiveInt = 5
    rerank_score_threshold: Optional[float] = 0.02


class LLMParams(BaseModel):
    max_new_tokens: int = 1024
    top_k: int = 10
    top_p: float = 0.95
    typical_p: float = 0.95
    temperature: float = 0.01
    repetition_penalty: float = 1.03
    stream: bool = True


class QueryRewriteParams(BaseModel):
    max_new_tokens: int = 256
    temperature: float = 0.1


class DocsumParams(BaseModel):
    summary_type: Literal["map_reduce", "refine", "stuff"] = "map_reduce"
    max_new_tokens: PositiveInt = 1024
    stream: bool = True


class FingerprintConfig(BaseModel):
    """Value object mirroring a single ``fingerprint_config`` row.

    The relational store is keyed by the composite ``(pipeline, tenant,
    params_key)``. ``params_kind`` records the group part (``llm``,
    ``retriever``, ``input_guard``, ...) while ``values`` holds the JSON
    payload for that part.
    """

    pipeline: str
    tenant: str = "_global"
    params_key: str
    params_kind: str
    values: dict = {}
    schema_version: int = 1
    version: int = 1
    updated_at: Optional[datetime] = None
