import pytest
from comps.vectorstores.utils.connectors.connector_redis import ConnectorRedis
import os
import random
import string

@pytest.fixture
def connector_redis():
    return ConnectorRedis()

@pytest.mark.parametrize(
    "env_vars, expected_url_template",
    [
        (
            {"REDIS_URL": "redis://localhost:6379", "VECTOR_STORE": "redis"},
            "redis://localhost:6379/",
        ),
        (
            {"REDIS_URL": "redis://localhost:6379", "VECTOR_STORE": "redis-cluster"},
            "redis://localhost:6379/?cluster=true",
        ),
        (
            {"REDIS_URL": "redis://localhost:6379?cluster=true", "VECTOR_STORE": "redis"},
            "redis://localhost:6379/?cluster=true",
        ),
        (
            {"REDIS_URL": "redis://localhost:6379?cluster=true", "VECTOR_STORE": "redis-cluster"},
            "redis://localhost:6379/?cluster=true",
        ),
        (
            {"REDIS_HOST": "localhost", "REDIS_PORT": "1234", "VECTOR_STORE": "redis"},
            "redis://localhost:1234/",
        ),
         (
            {"REDIS_HOST": "localhost", "REDIS_PORT": "1234", "REDIS_SSL": "true", "VECTOR_STORE": "redis"},
            "rediss://localhost:1234/",
        ),
        (
            {"REDIS_HOST": "localhost", "REDIS_PORT": "1234", "VECTOR_STORE": "redis-cluster"},
            "redis://localhost:1234/?cluster=true",
        ),
        (
            {"REDIS_HOST": "localhost", "REDIS_PORT": "1234", "REDIS_USERNAME": 'test', "REDIS_PASSWORD": "{password}", "VECTOR_STORE": "redis-cluster"},
            "redis://test:{password}@localhost:1234/?cluster=true",
        ),
        (
            {"REDIS_HOST": "localhost", "REDIS_PORT": "1234", "REDIS_USERNAME": 'test', "REDIS_PASSWORD": "{password}", "VECTOR_STORE": "redis"},
            "redis://test:{password}@localhost:1234/",
        ),
    ],
)
def test_format_url_from_env(connector_redis, env_vars, expected_url_template):
    # Generate a random password for each test run
    password_chars = string.ascii_letters + string.digits + string.punctuation # nosec B311
    password = ''.join(random.choice(password_chars) for _ in range(12)) # nosec B311
    
    # Replace password placeholder in env_vars and expected_url if needed
    for key in env_vars:
        if isinstance(env_vars[key], str) and "{password}" in env_vars[key]:
            env_vars[key] = env_vars[key].format(password=password)
    
    expected_url = expected_url_template.format(password=password) if "{password}" in expected_url_template else expected_url_template

    # Set environment variables
    for key, value in env_vars.items():
        os.environ[key] = value
    
    try:
        # Call the function and assert the result
        assert connector_redis.format_url_from_env() == expected_url
    finally:
        # Clean up environment variables
        for key in env_vars.keys():
            if key in os.environ:
                del os.environ[key]


# ---------------------------------------------------------------------------
# Hybrid search: contextual BM25 + contextual embeddings fused with weighted RRF
# (Anthropic Contextual Retrieval).
# ---------------------------------------------------------------------------

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch


class FakeRedisDoc(dict):
    """A stand-in for a raw RediSearch result row.

    _convert_to_text_doc() reads fields by subscription, while the fusion code reads
    `.id` and (for the BM25 leg) `.score` as attributes -- exactly as redis-py exposes them.
    """

    def __init__(self, doc_id, text, score=None, **fields):
        super().__init__(text=text, **fields)
        self.id = doc_id
        if score is not None:
            self.score = score


def _leg(*docs):
    """similarity_search_by_vector/bm25_search return the raw result (with .docs) when
    called with parse_result=False."""
    return SimpleNamespace(docs=list(docs))


@pytest.mark.parametrize(
    "text, expected",
    [
        ("Nvidia data center revenue", True),
        ("what is the?", False),      # every token is a stopword
        ("?? ... ,", False),          # punctuation only
        ("", False),
        ("   ", False),
    ],
)
def test_has_lexical_tokens(text, expected):
    assert ConnectorRedis._has_lexical_tokens(text) is expected


def test_reciprocal_rank_fusion_default_is_anthropic_weight_over_rank():
    # Anthropic's reference implementation scores a hit as weight * 1/(index + 1) with no
    # smoothing constant, so rrf_k defaults to 0.
    scores = ConnectorRedis._reciprocal_rank_fusion([(["a", "b", "c"], 1.0)])
    assert scores == pytest.approx({"a": 1.0, "b": 0.5, "c": 1 / 3})


def test_reciprocal_rank_fusion_sums_weighted_ranks_across_legs():
    # 'a' is vector rank 1 and BM25 rank 3; 'b' appears only in the BM25 leg, at rank 1.
    scores = ConnectorRedis._reciprocal_rank_fusion(
        [(["a", "x", "y"], 0.8), (["b", "z", "a"], 0.2)]
    )
    assert scores["a"] == pytest.approx(0.8 / 1 + 0.2 / 3)
    assert scores["b"] == pytest.approx(0.2 / 1)


def test_reciprocal_rank_fusion_lets_the_lexical_leg_promote_a_chunk():
    # The point of rrf_k=0: at 0.8/0.2 weighting a BM25 top hit (0.2) beats the dense leg
    # from rank 5 down (0.8/5 = 0.16), so the lexical leg can promote chunks the dense leg
    # missed. With rrf_k=60 it cannot promote anything at all -- 0.2/61 < 0.8/(60+150).
    dense = [f"v{i}" for i in range(1, 11)]
    sharp = ConnectorRedis._reciprocal_rank_fusion([(dense, 0.8), (["b"], 0.2)], rrf_k=0)
    assert sharp["b"] > sharp["v5"]

    flat = ConnectorRedis._reciprocal_rank_fusion([(dense, 0.8), (["b"], 0.2)], rrf_k=60)
    assert flat["b"] < min(flat[doc_id] for doc_id in dense)


def test_reciprocal_rank_fusion_smoothing_constant_flattens_ranks():
    flat = ConnectorRedis._reciprocal_rank_fusion([(["a", "b"], 1.0)], rrf_k=60)
    assert flat == pytest.approx({"a": 1 / 61, "b": 1 / 62})
    sharp = ConnectorRedis._reciprocal_rank_fusion([(["a", "b"], 1.0)], rrf_k=0)
    assert (sharp["a"] / sharp["b"]) > (flat["a"] / flat["b"])


def test_reciprocal_rank_fusion_ignores_zero_weight_leg():
    scores = ConnectorRedis._reciprocal_rank_fusion([(["a"], 1.0), (["b"], 0.0)])
    assert "b" not in scores


@pytest.fixture
def hybrid_connector(connector_redis):
    """A connector whose two retrieval legs are stubbed out.

    Vector leg: v1, shared, v2. BM25 leg: b1, shared. 'shared' is found by both.
    """
    connector_redis.similarity_search_by_vector = AsyncMock(return_value=_leg(
        FakeRedisDoc("erag:v1", "vector one", vector_distance=0.11, object_name="a.txt"),
        FakeRedisDoc("erag:shared", "in both legs", vector_distance=0.22, object_name="b.txt"),
        FakeRedisDoc("erag:v2", "vector two", vector_distance=0.33, object_name="c.txt"),
    ))
    connector_redis.bm25_search = AsyncMock(return_value=_leg(
        FakeRedisDoc("erag:b1", "lexical one", score=12.5, object_name="d.txt"),
        FakeRedisDoc("erag:shared", "in both legs", score=9.5, object_name="b.txt"),
    ))
    with patch.object(ConnectorRedis, "_metadata_schema", return_value=[{"name": "object_name"}]):
        yield connector_redis


@pytest.mark.asyncio
async def test_hybrid_search_fuses_both_legs(hybrid_connector):
    result = await hybrid_connector.hybrid_search_by_vector(
        input_text="query", embedding=[0.1, 0.2, 0.3], k=4
    )

    assert result.user_prompt == "query"
    texts = [doc.text for doc in result.retrieved_docs]
    assert len(texts) == len(set(texts)) == 4  # every candidate once, no duplicates

    sources = [doc.metadata["retrieval_source"] for doc in result.retrieved_docs]
    assert sources.count("hybrid") == 1  # the chunk both legs found
    assert "bm25" in sources             # the lexical leg promoted a chunk of its own

    scores = [doc.metadata["rrf_score"] for doc in result.retrieved_docs]
    assert scores == sorted(scores, reverse=True)

    by_text = {doc.text: doc.metadata for doc in result.retrieved_docs}
    # 'shared' is vector rank 2 and BM25 rank 2.
    assert by_text["in both legs"]["rrf_score"] == pytest.approx(0.8 / 2 + 0.2 / 2)
    assert by_text["in both legs"]["vector_rank"] == 2
    assert by_text["in both legs"]["bm25_rank"] == 2
    assert by_text["in both legs"]["bm25_score"] == pytest.approx(9.5)
    assert by_text["in both legs"]["vector_distance"] == 0.22
    # A BM25-only chunk has no vector distance, which is why downstream consumers must
    # read rrf_score rather than vector_distance.
    assert "vector_distance" not in by_text["lexical one"]
    assert by_text["lexical one"]["rrf_score"] == pytest.approx(0.2 / 1)


@pytest.mark.asyncio
async def test_hybrid_search_fetches_candidate_k_from_each_leg(hybrid_connector):
    await hybrid_connector.hybrid_search_by_vector(
        input_text="query", embedding=[0.1], k=10, candidate_k=150
    )
    assert hybrid_connector.similarity_search_by_vector.await_args.kwargs["k"] == 150
    assert hybrid_connector.bm25_search.await_args.kwargs["k"] == 150


@pytest.mark.asyncio
async def test_hybrid_search_raises_candidate_k_to_at_least_k(hybrid_connector):
    await hybrid_connector.hybrid_search_by_vector(
        input_text="query", embedding=[0.1], k=20, candidate_k=5
    )
    assert hybrid_connector.similarity_search_by_vector.await_args.kwargs["k"] == 20
    assert hybrid_connector.bm25_search.await_args.kwargs["k"] == 20


@pytest.mark.asyncio
async def test_hybrid_search_applies_the_same_filter_to_both_legs(hybrid_connector):
    await hybrid_connector.hybrid_search_by_vector(
        input_text="query", embedding=[0.1], k=4, filter_expression="@bucket_name:{docs}"
    )
    assert hybrid_connector.similarity_search_by_vector.await_args.kwargs[
        "filter_expression"] == "@bucket_name:{docs}"
    assert hybrid_connector.bm25_search.await_args.kwargs[
        "filter_expression"] == "@bucket_name:{docs}"


@pytest.mark.asyncio
async def test_hybrid_search_with_zero_bm25_weight_is_dense_only(hybrid_connector):
    result = await hybrid_connector.hybrid_search_by_vector(
        input_text="query", embedding=[0.1], k=4, bm25_weight=0.0
    )
    assert all(doc.metadata["retrieval_source"] == "vector" for doc in result.retrieved_docs)
    hybrid_connector.bm25_search.assert_not_awaited()


@pytest.mark.asyncio
async def test_hybrid_search_with_zero_semantic_weight_is_lexical_only(hybrid_connector):
    result = await hybrid_connector.hybrid_search_by_vector(
        input_text="query", embedding=[0.1], k=4, semantic_weight=0.0
    )
    assert all(doc.metadata["retrieval_source"] == "bm25" for doc in result.retrieved_docs)
    hybrid_connector.similarity_search_by_vector.assert_not_awaited()


@pytest.mark.asyncio
async def test_hybrid_search_rejects_two_zero_weights(hybrid_connector):
    with pytest.raises(ValueError):
        await hybrid_connector.hybrid_search_by_vector(
            input_text="query", embedding=[0.1], k=4, semantic_weight=0.0, bm25_weight=0.0
        )


@pytest.mark.asyncio
async def test_hybrid_search_degrades_to_vector_only_when_bm25_fails(hybrid_connector):
    hybrid_connector.bm25_search = AsyncMock(side_effect=RuntimeError("RediSearch is down"))

    result = await hybrid_connector.hybrid_search_by_vector(
        input_text="query", embedding=[0.1], k=4
    )

    assert [doc.text for doc in result.retrieved_docs] == [
        "vector one", "in both legs", "vector two"
    ]
    assert all(doc.metadata["retrieval_source"] == "vector" for doc in result.retrieved_docs)


@pytest.mark.asyncio
async def test_hybrid_search_propagates_a_vector_leg_failure(hybrid_connector):
    # The dense leg is the primary retriever, so its failure is a real failure.
    hybrid_connector.similarity_search_by_vector = AsyncMock(side_effect=RuntimeError("boom"))
    with pytest.raises(RuntimeError):
        await hybrid_connector.hybrid_search_by_vector(
            input_text="query", embedding=[0.1], k=4
        )


@pytest.mark.asyncio
async def test_hybrid_search_returns_no_docs_when_both_legs_are_empty(hybrid_connector):
    hybrid_connector.similarity_search_by_vector = AsyncMock(return_value=_leg())
    hybrid_connector.bm25_search = AsyncMock(return_value=_leg())

    result = await hybrid_connector.hybrid_search_by_vector(
        input_text="query", embedding=[0.1], k=4
    )
    assert result.retrieved_docs == []
    assert result.user_prompt == "query"
