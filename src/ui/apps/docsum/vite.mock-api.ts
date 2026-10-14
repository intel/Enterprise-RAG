// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import type { Plugin } from "vite";

// Dev-only mock backend, gated by VITE_MOCK_API=true in a gitignored
// .env.local (same pattern as VITE_SKIP_AUTH — see main.tsx and chatqna's /
// audioqna's own vite.mock-api.ts). Lets `vite dev` stream a summary and render
// the Control Plane pipeline graph without a reachable solutions.ai backend.
// Not wired into any production or CI build path.

const sendJson = (
  res: import("node:http").ServerResponse,
  status: number,
  body: unknown,
) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

const drainBody = (req: import("node:http").IncomingMessage) =>
  new Promise<void>((resolve, reject) => {
    req.on("data", () => {});
    req.on("end", () => resolve());
    req.on("error", reject);
  });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// OpenAI-style chunks — handleSummaryStreamResponse (src/features/docsum/utils/
// api.ts) reads choices[0].delta.content per `data:` event, then skips [DONE].
const SUMMARY_CHUNKS = [
  "This is a **mock summary** generated for local development. ",
  "The document describes Intel® AI for Enterprise RAG, ",
  "a retrieval-augmented generation platform.\n\n",
  "- Pipelines are declared as ordered flows of steps.\n",
  "- The GMC operator reconciles the microservices behind them.\n",
  "- Changing retrieval strategy is a config edit, not a rewrite.",
];

// Keys must contain "v1:<serviceName>" as a contiguous substring — see
// SERVICE_NAME_NODE_ID_MAP in src/features/admin-panel/control-plane/utils/
// api.ts; a node with no matching status annotation is dropped from the graph.
const DOCSUM_STATUS_ANNOTATIONS = {
  "Deployment:apps/v1:docsum-svc": "Ready",
  "Deployment:apps/v1:llm-svc": "Ready",
  "Deployment:apps/v1:text-compression-svc": "Ready",
  "Deployment:apps/v1:text-extractor-svc": "Ready",
  "Deployment:apps/v1:text-splitter-svc": "Ready",
  "Deployment:apps/v1:vllm-service-m": "Ready",
};

const mockDocSumStatus = {
  apiVersion: "gmc.opea.io/v1alpha3",
  kind: "GMConnector",
  metadata: {
    annotations: {},
    creationTimestamp: "2026-09-25T00:00:00Z",
    generation: 1,
    labels: {},
    managedFields: [],
    name: "docsum",
    namespace: "docsum",
    resourceVersion: "1",
    uid: "mock-uid",
  },
  spec: { nodes: { root: { routerType: "sequence", steps: [] } } },
  status: {
    accessUrl: "",
    annotations: DOCSUM_STATUS_ANNOTATIONS,
    condition: {},
    status: "Ready",
  },
};

export const mockApiPlugin = (): Plugin => {
  return {
    name: "docsum-mock-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();
        const url = new URL(req.url, "http://localhost");

        // A 404 here is the explicitly tolerated "no stored row, use the
        // node's static default args" path in getServicesData.
        if (
          url.pathname === "/v1/system_fingerprint/config" &&
          req.method === "GET"
        ) {
          return sendJson(res, 404, { detail: "Not found" });
        }

        if (url.pathname === "/api/v1/docsum/status" && req.method === "GET") {
          return sendJson(res, 200, mockDocSumStatus);
        }

        if (url.pathname === "/api/v1/docsum" && req.method === "POST") {
          await drainBody(req);
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");

          // Chunked with a delay so the streaming/pending UI state is visible.
          for (const content of SUMMARY_CHUNKS) {
            await sleep(250);
            res.write(
              `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
            );
          }
          res.write("data: [DONE]\n\n");
          return res.end();
        }

        next();
      });
    },
  };
};
