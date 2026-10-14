// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import type { Plugin } from "vite";

// Dev-only mock backend, gated by VITE_MOCK_API=true in a gitignored
// .env.local (same pattern as VITE_SKIP_AUTH — see main.tsx and chatqna's own
// vite.mock-api.ts). Lets `vite dev` render the chat view (prompt, ASR, TTS)
// and the Control Plane pipeline graph without a reachable solutions.ai
// backend. Not wired into any production or CI build path.
//
// getServicesData (packages/control-plane/src/store/createControlPlaneApi.ts)
// fans out to GET_SERVICE_CONFIG per params key plus the status endpoints; a
// non-404 config error aborts the whole hydration, so config reads mock a 404
// ("no stored row" — an explicitly tolerated path, already used to mean "use
// the node's static default args" from apps/audioqna/src/features/admin-panel/
// control-plane/config/graph.ts). Only the status endpoints need real 200s,
// since updateNodes (packages/control-plane/src/utils/graph.ts) drops any node
// without a status annotation from the rendered graph.

const sendJson = (
  res: import("node:http").ServerResponse,
  status: number,
  body: unknown,
) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

const readBody = (req: import("node:http").IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });

const parseJson = (raw: string): Record<string, unknown> => {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

interface MockChat {
  id: string;
  history_name: string;
  created_at: string;
  history: { question: string; answer?: string; timestamp?: string | null }[];
}

// Same chat-history contract as chatqna's mock (packages/chat is shared).
const seedChats = (): Map<string, MockChat> =>
  new Map(
    [
      {
        id: "mock-chat-1",
        history_name: "What voices does TTS support?",
        created_at: "2026-09-20T09:15:00.000Z",
        history: [
          {
            question: "What voices does TTS support?",
            answer: "The mock TTS service returns a short silent clip.",
            timestamp: "2026-09-20T09:15:04.000Z",
          },
        ],
      },
    ].map((chat) => [chat.id, chat]),
  );

// 0.5s of 16 kHz mono 16-bit PCM silence — a real, playable audio/wav body so
// useTextToSpeech's validateAudioBlob + <audio> playback path runs end to end.
const buildSilentWav = (durationSeconds = 0.5, sampleRate = 16000) => {
  const dataSize = Math.floor(durationSeconds * sampleRate) * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
};

// One "Deployment:apps/v1:<service-name>" annotation per node — status value
// must split-on-";" to one of ServiceStatus's members (packages/control-plane
// src/types/index.ts). Split across the two status endpoints the way real
// audio/chatqna status responses do (audio-specific vs. the shared RAG chain).
const AUDIO_STATUS_ANNOTATIONS = {
  "Deployment:apps/v1:asr-svc": "Ready",
  "Deployment:apps/v1:tts-svc": "Ready",
  "Deployment:apps/v1:tts-fastapi-model-server": "Ready",
  "Deployment:apps/v1:vllm-audio-cpu": "Ready",
};

const CHATQNA_STATUS_ANNOTATIONS = {
  "Deployment:apps/v1:tei-embedding-svc": "Ready",
  "Deployment:apps/v1:embedding-svc": "Ready",
  "Deployment:apps/v1:retriever-svc": "Ready",
  "Deployment:apps/v1:redis-vector-db": "Ready",
  "Deployment:apps/v1:reranking-svc": "Ready",
  "Deployment:apps/v1:tei-reranking-svc": "Ready",
  "Deployment:apps/v1:prompt-template-svc": "Ready",
  "Deployment:apps/v1:input-scan-svc": "Ready",
  "Deployment:apps/v1:llm-svc": "Ready",
  "Deployment:apps/v1:vllm-service-m": "Ready",
  "Deployment:apps/v1:output-scan-svc": "Ready",
};

const mockNamespaceStatus = (annotations: Record<string, string>) => ({
  apiVersion: "gmc.opea.io/v1alpha3",
  kind: "GMConnector",
  metadata: {
    annotations: {},
    creationTimestamp: "2026-09-25T00:00:00Z",
    generation: 1,
    labels: {},
    managedFields: [],
    name: "mock-namespace",
    namespace: "mock-namespace",
    resourceVersion: "1",
    uid: "mock-uid",
  },
  spec: { nodes: { root: { routerType: "sequence", steps: [] } } },
  status: {
    accessUrl: "",
    annotations,
    condition: {},
    status: "Ready",
  },
});

// Minimal fixtures for the Data Ingestion Files/Links redesign — enough rows/sizes/statuses to
// exercise pinned columns, horizontal scroll, and every filter variant (select/text/range) live.
const MOCK_FILES = [
  {
    id: "file-1",
    created_at: "2026-09-20T10:00:00Z",
    chunk_size: 512,
    chunks_total: 10,
    chunks_processed: 10,
    status: "ingested",
    job_name: "job-1",
    job_message: "",
    job_start_time: 0,
    text_extractor_duration: 1,
    text_compression_duration: 1,
    text_splitter_duration: 1,
    dpguard_duration: 1,
    late_chunking_duration: 1,
    embedding_duration: 1,
    ingestion_duration: 1,
    processing_duration: 5,
    bucket_name: "erag-bucket",
    object_name: "quarterly-report.pdf",
    size: 2_500_000,
    etag: "etag-1",
    site_name: null,
    embedding_model: "bge-base-en-v1.5",
  },
  {
    id: "file-2",
    created_at: "2026-09-21T10:00:00Z",
    chunk_size: 512,
    chunks_total: 4,
    chunks_processed: 2,
    status: "error",
    job_name: "job-2",
    job_message: "Text extraction failed",
    job_start_time: 0,
    text_extractor_duration: 1,
    text_compression_duration: 0,
    text_splitter_duration: 0,
    dpguard_duration: 0,
    late_chunking_duration: 0,
    embedding_duration: 0,
    ingestion_duration: 0,
    processing_duration: 1,
    bucket_name: "erag-bucket",
    object_name: "corrupted-scan.pdf",
    size: 800_000,
    etag: "etag-2",
    site_name: null,
    embedding_model: null,
  },
  {
    id: "file-3",
    created_at: "2026-09-22T10:00:00Z",
    chunk_size: 512,
    chunks_total: 20,
    chunks_processed: 20,
    status: "ingested",
    job_name: "job-3",
    job_message: "",
    job_start_time: 0,
    text_extractor_duration: 2,
    text_compression_duration: 2,
    text_splitter_duration: 2,
    dpguard_duration: 1,
    late_chunking_duration: 1,
    embedding_duration: 2,
    ingestion_duration: 2,
    processing_duration: 12,
    bucket_name: null,
    object_name: "onboarding-guide.docx",
    size: 15_000_000,
    etag: "etag-3",
    site_name: "Engineering",
    embedding_model: "bge-base-en-v1.5",
  },
];

const MOCK_LINKS = [
  {
    id: "link-1",
    created_at: "2026-09-20T10:00:00Z",
    chunk_size: 512,
    chunks_total: 8,
    chunks_processed: 8,
    status: "ingested",
    job_name: "job-4",
    job_message: "",
    job_start_time: 0,
    text_extractor_duration: 1,
    text_compression_duration: 1,
    text_splitter_duration: 1,
    dpguard_duration: 1,
    late_chunking_duration: 1,
    embedding_duration: 1,
    ingestion_duration: 1,
    processing_duration: 4,
    uri: "https://docs.internal.example.com/enterprise-rag/architecture",
    embedding_model: "bge-base-en-v1.5",
  },
  {
    id: "link-2",
    created_at: "2026-09-21T10:00:00Z",
    chunk_size: 512,
    chunks_total: 0,
    chunks_processed: 0,
    status: "processing",
    job_name: "job-5",
    job_message: "",
    job_start_time: 0,
    text_extractor_duration: 0,
    text_compression_duration: 0,
    text_splitter_duration: 0,
    dpguard_duration: 0,
    late_chunking_duration: 0,
    embedding_duration: 0,
    ingestion_duration: 0,
    processing_duration: 0,
    uri: "https://docs.internal.example.com/enterprise-rag/deployment-guide",
    embedding_model: null,
  },
];

export const mockApiPlugin = (): Plugin => {
  const chats = seedChats();
  let nextId = chats.size + 1;

  return {
    name: "audioqna-mock-api",
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
          const body = parseJson(await readBody(req));
          const id = (body.id as string) ?? `mock-chat-${nextId++}`;
          const history = (body.history as MockChat["history"]) ?? [];
          const existing = chats.get(id);
          const historyName =
            existing?.history_name ?? history[0]?.question ?? "New chat";
          const createdAt = existing?.created_at ?? new Date().toISOString();

          chats.set(id, {
            id,
            history_name: historyName,
            created_at: createdAt,
            history,
          });

          return sendJson(res, 200, {
            id,
            history_name: historyName,
            created_at: createdAt,
          });
        }

        if (
          url.pathname === "/v1/chat_history/change_name" &&
          req.method === "POST"
        ) {
          const body = parseJson(await readBody(req));
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
          url.pathname === "/v1/system_fingerprint/config" &&
          req.method === "GET"
        ) {
          return sendJson(res, 404, { detail: "Not found" });
        }

        if (url.pathname === "/api/v1/audio/status" && req.method === "GET") {
          return sendJson(
            res,
            200,
            mockNamespaceStatus(AUDIO_STATUS_ANNOTATIONS),
          );
        }

        if (url.pathname === "/api/v1/chatqna/status" && req.method === "GET") {
          return sendJson(
            res,
            200,
            mockNamespaceStatus(CHATQNA_STATUS_ANNOTATIONS),
          );
        }

        if (url.pathname === "/api/v1/edp/files" && req.method === "GET") {
          return sendJson(res, 200, MOCK_FILES);
        }

        if (url.pathname === "/api/v1/edp/links" && req.method === "GET") {
          return sendJson(res, 200, MOCK_LINKS);
        }

        if (
          url.pathname === "/api/v1/edp/list_buckets" &&
          req.method === "GET"
        ) {
          return sendJson(res, 200, ["erag-bucket"]);
        }

        if (
          url.pathname === "/api/v1/edp/sharepoint/sites" &&
          req.method === "GET"
        ) {
          return sendJson(res, 200, [
            { name: "engineering", display_name: "Engineering" },
          ]);
        }

        // Chat answer — same { text, json: { reranked_docs } } shape chatqna's
        // mock returns, since both apps share createQnAApi. Source docs carry the
        // full FileSource shape (object_name/bucket_name/site_name), or
        // FileSourceDialog crashes on name.length.
        if (url.pathname === "/api/v1/chatqna" && req.method === "POST") {
          const prompt = (parseJson(await readBody(req)).text as string) ?? "";
          await new Promise((resolve) => setTimeout(resolve, 1200));

          if (prompt.toLowerCase().includes("trigger error")) {
            return sendJson(res, 429, "Mock rate-limit error for dev testing.");
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

        if (
          url.pathname === "/v1/audio/transcriptions" &&
          req.method === "POST"
        ) {
          await readBody(req);
          return sendJson(res, 200, {
            text: "Mock transcription of the recorded audio",
          });
        }

        if (url.pathname === "/v1/audio/speech" && req.method === "POST") {
          await readBody(req);
          res.statusCode = 200;
          res.setHeader("Content-Type", "audio/wav");
          return res.end(buildSilentWav());
        }

        next();
      });
    },
  };
};
