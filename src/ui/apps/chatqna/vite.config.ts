// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import viteTsconfigPaths from "vite-tsconfig-paths";

import packageJson from "./package.json";
import { mockApiPlugin } from "./vite.mock-api";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");

  return {
    plugins: [
      tailwindcss(),
      react(),
      viteTsconfigPaths(),
      ...(env.VITE_MOCK_API === "true" ? [mockApiPlugin()] : []),
    ],
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(packageJson.version),
    },
    resolve: {
      alias: {
        "@/": path.resolve(__dirname, "./src/"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
            "intel-enterprise-rag-ui-auth": ["@intel-enterprise-rag-ui/auth"],
            "intel-enterprise-rag-ui-chat": ["@intel-enterprise-rag-ui/chat"],
            "intel-enterprise-rag-ui-components": [
              "@intel-enterprise-rag-ui/components",
            ],
            "intel-enterprise-rag-ui-control-plane": [
              "@intel-enterprise-rag-ui/control-plane",
            ],
            "intel-enterprise-rag-ui-icons": ["@intel-enterprise-rag-ui/icons"],
            "intel-enterprise-rag-ui-input-validation": [
              "@intel-enterprise-rag-ui/input-validation",
            ],
            "intel-enterprise-rag-ui-layouts": [
              "@intel-enterprise-rag-ui/layouts",
            ],
            "intel-enterprise-rag-ui-markdown": [
              "@intel-enterprise-rag-ui/markdown",
            ],
            "intel-enterprise-rag-ui-utils": ["@intel-enterprise-rag-ui/utils"],
          },
        },
      },
    },
    server: {
      proxy: {
        "^/api/v1/chatqna$": {
          target: "https://solutions.ai",
          changeOrigin: true,
          secure: false,
        },
        "^/v1/chat_history": {
          target: "https://solutions.ai",
          changeOrigin: true,
          secure: false,
        },
        "^/v1/system_fingerprint": {
          target: "https://solutions.ai",
          changeOrigin: true,
          secure: false,
        },
        "^/api/v1/chatqna/status$": {
          target: "https://solutions.ai",
          changeOrigin: true,
          secure: false,
        },
        "^/api/v1/edp": {
          target: "https://solutions.ai",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
