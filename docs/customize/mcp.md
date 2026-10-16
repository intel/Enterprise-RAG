# Model Context Protocol (MCP) Gateway

[← Customize](../README.md#customize)

The MCP gateway exposes Intel® AI for Enterprise RAG capabilities as tools that AI agents can discover and invoke over a persistent SSE connection.

Enable it when the consumer of your corpus is an agent rather than a person: the agent can search your documents and add new ones as part of a larger workflow, using your existing identity and access rules instead of a second copy of the data.

## Tool reference

Every tool is backed by EDP (Enhanced Data Preparation):

| Tool | Description |
|------|-------------|
| `retrieve_context` | Retrieve ranked document chunks from the knowledge base |
| `list_buckets` | List all available buckets (collections) in the knowledge base |
| `ingest_url` | Ingest a URL into the knowledge base for processing |
| `ingest_file` | Upload a file from base64-encoded content into a knowledge base bucket |
| `check_ingestion_status` | Check processing status of ingested files and URLs |

Tools not backed by a running service are not registered. Because all five tools need `EDP_ENDPOINT`, the `app_mcp_gateway` role asserts `edp_enabled: true` and fails the install rather than deploying a gateway with no tools.

## Authentication

The gateway is an OAuth 2.0 resource server. An Envoy Gateway `SecurityPolicy` on the MCP route validates the caller's JWT (signature, issuer, audience, expiry) before the request reaches the gateway. The service verifies it again against the realm's JWKS so that a request arriving by any other route is held to the same standard.

Agents obtain their own Keycloak access token with the `client_credentials` grant against their own client and send it as `Authorization: Bearer` on every request. No client secret ever reaches the gateway, and the gateway never mints a token of its own. The caller's token is what EDP sees, so a tool call cannot exceed the privileges of the agent that made it.

## Quick start: using the built-in client

When `mcp_enabled` is true, the Keycloak configurator Job creates a ready-to-use service-account client. Its ID comes from `mcp_keycloak_client_id` and defaults to `mcp-client`. The client is confidential, with `serviceAccountsEnabled: true` and standard, implicit, and browser flows disabled, so `client_credentials` is the only usable grant. Its service account gets:

- `ERAG-user` on `EnterpriseRAG-oidc-backend` (EDP access)
- `erag-admin-group` on `EnterpriseRAG-oidc-minio` (S3 read/write for `ingest_file`)
- A `minio_roles` client-role mapper, so those roles land in the token the EDP presigned-URL path authorizes against
- An audience mapper adding `mcp-gateway`, the audience the gateway requires
- `access.token.lifespan` of 900s, so agent tokens stay short-lived without changing the realm default

The credentials are stored in two places:

```bash
# Kubernetes Secret (source of truth)
kubectl get secret -n keycloak erag-credentials -o jsonpath='{.data.MCP_CLIENT_ID}' | base64 -d
kubectl get secret -n keycloak erag-credentials -o jsonpath='{.data.MCP_CLIENT_SECRET}' | base64 -d

# Credentials file written by app_keycloak_config
grep MCP_CLIENT env/<name>/logs/rag/default_credentials.txt
# MCP_CLIENT_ID=mcp-client
# MCP_CLIENT_SECRET="<generated-secret>"
```

> **Note:** `mcp-client` is intended for development, testing, and the e2e suite. For production integrations, create a dedicated client per agent (see [Creating a production agent client](#creating-a-production-agent-client-in-keycloak)).

> **Caution:** Remove `env/<name>/logs/rag/default_credentials.txt` once you have copied the values you need. It also holds Keycloak user passwords.

## Connecting an agent

An agent first exchanges its own client credentials for an access token at Keycloak, then presents that token on every MCP request. The client secret never leaves the agent.

```bash
# 1. Get a token (valid 900s for installer-created agent clients)
TOKEN=$(curl -s "https://keycloak.<base_domain_name>/realms/EnterpriseRAG/protocol/openid-connect/token" \
  -d grant_type=client_credentials \
  -d client_id=mcp-client \
  -d client_secret="<value from default_credentials.txt>" | jq -r .access_token)

# 2. Connect (add --no-buffer for streaming)
curl -N "https://<base_domain_name>/api/v1/mcp/sse" -H "Authorization: Bearer $TOKEN"
```

In `path` routing mode, the token URL is `https://<base_domain_name>/keycloak/realms/EnterpriseRAG/protocol/openid-connect/token`.

The first SSE frame is an `event: endpoint` frame carrying the session-scoped message URL. The MCP client then performs the `initialize` handshake and can call `tools/list`.

Every request needs a valid token, tool-call POSTs included, and the gateway binds each session to the identity that opened it:

| Case | Response |
|------|----------|
| No or unparseable `Authorization` header | 401 `invalid_token` |
| Signature, issuer, audience, or expiry rejected | 401 `invalid_token` |
| Tool call for a session opened by a different identity | 403 `session_mismatch` |
| Tool call for an unknown or expired session | 404 `unknown_session` |
| Session caps reached | 503 `too_many_sessions` / `too_many_sessions_per_client` |
| Rate limit exceeded | 429 |

Each 401 carries a `WWW-Authenticate` header with a `resource_metadata` pointer to `https://<base_domain_name>/api/v1/mcp/.well-known/oauth-protected-resource`, an RFC 9728 document naming the authorization server. A spec-compliant MCP client uses it to discover where to get a token and when to refresh.

### Token refresh

Tokens are short-lived, so an agent needs a token provider rather than a fixed header. An established SSE stream is authorized once at connect and is not re-validated mid-stream, so a long-running session survives token expiry. Only tool calls need a current token. Clients that accept only a static header map in a config file cannot refresh; wrap them in something that can, or raise `access.token.lifespan` on that single client and accept the trade-off.

### Example: Python agent using the MCP SDK

```python
import asyncio
import os
import time

import httpx
from mcp.client.session import ClientSession
from mcp.client.sse import sse_client

BASE_DOMAIN = os.environ["BASE_DOMAIN_NAME"]
MCP_URL = f"https://{BASE_DOMAIN}/api/v1/mcp/sse"
CLIENT_ID = os.environ["MCP_CLIENT_ID"]          # "mcp-client", or your production client
CLIENT_SECRET = os.environ["MCP_CLIENT_SECRET"]

TOKEN_URL = f"https://keycloak.{BASE_DOMAIN}/realms/EnterpriseRAG/protocol/openid-connect/token"

_token = {"value": None, "expires_at": 0.0}


def access_token() -> str:
    # Tokens live 900s by default, and every tool-call POST carries one, so fetch on first
    # use and refresh shortly before expiry.
    if _token["value"] and time.monotonic() < _token["expires_at"] - 30:
        return _token["value"]
    r = httpx.post(
        TOKEN_URL,
        data={
            "grant_type": "client_credentials",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        },
    )
    r.raise_for_status()
    payload = r.json()
    _token["value"] = payload["access_token"]
    _token["expires_at"] = time.monotonic() + int(payload.get("expires_in", 300))
    return _token["value"]


class BearerAuth(httpx.Auth):
    def auth_flow(self, request):
        request.headers["Authorization"] = f"Bearer {access_token()}"
        yield request


def client_factory(headers=None, timeout=None, auth=None):
    # Auth is applied per request, not as a fixed header, so the session keeps working
    # after the token it was opened with has expired.
    return httpx.AsyncClient(
        headers=headers or {}, timeout=timeout or httpx.Timeout(120), auth=BearerAuth()
    )


async def main():
    async with sse_client(MCP_URL, httpx_client_factory=client_factory) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = await session.list_tools()
            print([t.name for t in tools.tools])

            buckets = await session.call_tool("list_buckets", {})
            print(buckets.content)

            result = await session.call_tool(
                "retrieve_context",
                {"query": "What is the data retention policy?", "top_n": 3},
            )
            print(result.content)


asyncio.run(main())
```

## Tool parameters

### retrieve_context

Retrieves ranked document chunks from the knowledge base without generating an LLM answer.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | Natural-language search phrase |
| `top_n` | integer | `5` | Number of ranked chunks to return if reranker is enabled |
| `k` | integer | `32` | Number of candidates to retrieve from retriever. Must be >= `top_n` |
| `reranker` | boolean | `true` | Apply reranking step; set `false` for faster but less precise results |
| `search_type` | string | `"similarity"` | Vector search algorithm (`similarity` \| `similarity_search_with_siblings` \| `similarity_distance_threshold`) |

Returns: `list[dict]` - each item has `text` (string) and `metadata` (dict) fields, ordered by relevance descending.

### list_buckets

Lists all available buckets (collections) in the knowledge base.

No parameters.

Returns: `list[str]` - bucket name strings.

### ingest_url

Ingests a URL into the knowledge base for processing. The EDP pipeline fetches the content, extracts text, chunks it, and generates embeddings. Processing starts asynchronously.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required | URL to ingest (e.g. `https://example.com/document.pdf`). Must be reachable by the EDP service. |

Returns: `dict` with `message` and `id` (list of link IDs created in the ingestion queue).

> **Note:** The URL must be reachable from within the cluster. For files behind external authentication or files you already have as bytes, use `ingest_file` instead.

### ingest_file

Uploads a file into the knowledge base from base64-encoded content.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bucket` | string | required | Destination bucket (collection) name. Must already exist. |
| `filename` | string | required | Object name to store the file as (e.g. `reports/q1.pdf`) |
| `content_base64` | string | required | Base64-encoded file bytes (standard alphabet with padding) |
| `content_type` | string | `"application/octet-stream"` | MIME type hint for the processing pipeline |

Returns: `dict` with `bucket`, `filename`, and `status: "ingestion_started"`.

### check_ingestion_status

Check processing status of files and URLs in the knowledge base. Query by bucket/filename (for files) or URL (for links).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bucket` | string | `None` | Filter files by bucket name |
| `id` | string | `None` | Filter files and URLs by unique ID |
| `filename` | string | `None` | Filter files by object name |
| `url` | string | `None` | Filter links by URL |

Returns: `list[dict]` - file entries contain `id`, `bucket_name`, `object_name`, `status`, `chunks_total`, `chunks_processed`, `job_message`, `created_at`, and `size`. Link entries contain `id`, `uri`, `status`, `chunks_total`, `chunks_processed`, `job_message`, `created_at`.

Status values: `uploaded`, `processing`, `ingested`, `error`, `deleting`, `canceled`.

## Configuration reference

Set in `env/<name>/config.erag.yaml` (flat keys, shallow-merged via `-e @file`):

| Option | Default | Description |
|--------|---------|-------------|
| `mcp_enabled` | `false` | Deploy the MCP gateway. Read at component-resolve time, so it must be a static key. |
| `mcp_namespace` | `mcp-gateway` | Namespace for the gateway Deployment, Service, `HTTPRoute`, and `SecurityPolicy`. |
| `mcp_service_port` | `8000` | Container and Service port. |
| `mcp_route_timeout` | `"0s"` | Route request timeout. `0s` disables it for long-lived SSE streams. |
| `mcp_allowed_hosts` | deployment domain + in-cluster service names | Accepted `Host` header values. |
| `mcp_s3_tls_verify` | `true` | TLS verification for the outbound presigned S3 upload. Set `false` only for development. |
| `mcp_ca_secret_name` | `mcp-gateway-ca` | Secret in `mcp_namespace` holding the copied gateway `tls.crt`, mounted as the outbound CA bundle. |
| `mcp_keycloak_client_id` | `mcp-client` | Keycloak client ID created by the configurator Job. |
| `mcp_jwt_audience` | `mcp-gateway` | Audience caller tokens must carry. Agent clients get an audience mapper for this value. |
| `mcp_jwt_algorithms` | `RS256,RS384` | Signing algorithms accepted. The realm signs with RS384. |
| `mcp_access_token_lifespan` | `900` | Per-client access token lifespan in seconds for agent clients. |
| `mcp_rate_limit_enabled` | `true` | Apply local rate limiting to the MCP routes. |
| `mcp_rate_limit_per_client_requests` | `120` | Requests per minute per calling agent, keyed on the `azp` claim. |
| `mcp_rate_limit_route_requests` | `600` | Requests per minute for the route as a whole. |

Rate limits are `type: Local`, so no rate-limit service is deployed and counters are per Envoy pod. The EnvoyProxy runs as a DaemonSet, which makes the effective cluster-wide ceiling the configured limit multiplied by the number of gateway pods. Requests over the limit get HTTP 429.

Session limits live in the chart (`deployment/components/mcp_gateway/values.yaml`) and reach the container as environment variables:

| Chart value | Env var | Default | Description |
|-------------|---------|---------|-------------|
| `config.maxSessions` | `MCP_MAX_SESSIONS` | `100` | Maximum concurrent SSE sessions |
| `config.maxSessionsPerClient` | `MCP_MAX_SESSIONS_PER_CLIENT` | `5` | Maximum sessions per `client_id` |
| `config.sessionInactivityTimeout` | `MCP_SESSION_INACTIVITY_TIMEOUT` | `600` | Seconds of inactivity before a session is closed |

For the full service-level environment variable list, see [`src/mcp_gateway/README.md`](../../src/mcp_gateway/README.md).

## Retrieval-only deployments

The MCP gateway is often the only consumer a deployment needs, in which case the LLM half of ChatQnA is dead weight. The optional `retrieve-rerank` ChatQnA variant removes it:

```yaml
# env/<name>/config.erag.yaml
pipeline_type: "chatqna"
pipeline_variant: "retrieve-rerank"
mcp_enabled: true
```

This is a **retrieval-only deployment: there are no chat answers.** Consumers call retrieval directly, through the MCP gateway's `retrieve_context` or EDP's retrieval endpoint.

The UI reflects this. `app_ui` lists the variant in `ui_no_llm_pipeline_variants`, which drives `ui_chat_maintenance_mode` and sets `chatMaintenanceReason: no-llm`. The ChatQnA app then renders a "Chat Not Available" notice on the chat routes explaining that the deployment is retrieval-only, while the Admin Panel stays fully usable for document and pipeline management.

Known limitations of this variant in the current release:

- **AudioQnA chat routes ignore maintenance mode.** Only the ChatQnA app checks `MAINTENANCE_MODE` on its chat routes, so an `audioqna` flavour with `pipeline_variant: retrieve-rerank` still presents a chat view that cannot answer.
- **`/api/v1/chatqna` stays published.** The pipeline router and the UI nginx config expose it regardless of variant. Callers that hit it directly get a response with no generated text rather than a clear error.
- **The LLM model may still be deployed.** `inference_models` in `config.erag.yaml` is independent of the composed flow, so a `role: llm` entry is still served even though no pipeline step consumes it. Remove it from `inference_models` to reclaim the resources.

## Creating a production agent client in Keycloak

`mcp-client` is for development and testing. For production integrations, create a dedicated client per agent so credentials can be rotated or revoked independently. Each production client needs three things: an Intel AI for Enterprise RAG role for backend access, `erag-admin-group` on `EnterpriseRAG-oidc-minio` for S3 file operations, and a `minio_roles` claim mapper.

The Keycloak admin console is at `https://keycloak.<base_domain_name>` in `subdomain` routing mode, or `https://<base_domain_name>/keycloak` in `path` routing mode.

### Using the Keycloak admin console

1. Log in to the Keycloak admin console and select the `EnterpriseRAG` realm
2. Navigate to **Clients** → **Create client**
3. Set a **Client ID** (e.g. `my-agent`)
4. Enable **Client authentication** (disables public client mode)
5. Disable **Standard flow** and **Direct access grants**
6. Enable **Service accounts roles** → **Save**
7. Open the **Credentials** tab and copy the client secret
8. Open the **Service accounts roles** tab → **Assign role** → select `ERAG-admin`, `ERAG-user`, or `ERAG-maintainer` as appropriate
9. To enable `ingest_url` and `ingest_file`: go to **Clients → EnterpriseRAG-oidc-minio → Service account roles** for `service-account-my-agent` → assign `erag-admin-group`
10. Add a **Client scope mapper**: **Clients → my-agent → Client scopes → Add mapper → By configuration → User Client Role** → set Token Claim Name to `minio_roles`, Client ID to `EnterpriseRAG-oidc-minio`

## Security notes

- **Do not use `mcp-client` in production.** Create a dedicated client per agent so credentials can be rotated or revoked independently, and so audit trails attribute activity to one agent.
- **`mcp-client` is privileged on object storage.** Its service account carries `erag-admin-group` on `EnterpriseRAG-oidc-minio`, which maps to S3 read/write. Treat its secret as an object-store credential.
- **Revoke a compromised agent** by disabling or deleting its Keycloak client. Other agents are unaffected.
- **The MCP data path is authenticated at the edge and again in the service.** The route `SecurityPolicy` validates signature, issuer, audience, and expiry; the service re-verifies against the realm JWKS. Only `/api/v1/mcp/health` and the protected-resource metadata document are unauthenticated.
- **Session UUIDs are not credentials.** They travel in the query string and therefore reach access logs. Each session is bound to the identity that opened it, so a tool call presenting someone else's session gets 403.
- **Production agent clients must have `erag-admin-group` on `EnterpriseRAG-oidc-minio`** and a `minio_roles` claim mapper for `ingest_url` and `ingest_file` to work.

## Related docs

| Topic | Link |
|-------|------|
| MCP gateway source code and service-level env vars | [`src/mcp_gateway/README.md`](../../src/mcp_gateway/README.md) |
| Pipeline variants | [`../deploy/pipelines.md`](../deploy/pipelines.md) |
