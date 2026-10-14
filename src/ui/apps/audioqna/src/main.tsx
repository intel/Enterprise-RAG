// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./index.css";

import { bootstrapApp } from "@intel-enterprise-rag-ui/layouts";

import App from "@/app";
import { paths } from "@/config/paths";
import { getAudioQnAAppEnv } from "@/utils";
import { onRefreshTokenFailed } from "@/utils/api";

// Dev-only escape hatch for local automation (axe-core, Lighthouse) that
// cannot follow a real Keycloak redirect — set VITE_SKIP_AUTH=true in a
// gitignored .env.local. import.meta.env.DEV is statically false in every
// production build, so this is dead code (dropped entirely) outside `vite
// dev` regardless of the env var's value.
const skipAuth =
  import.meta.env.DEV && import.meta.env.VITE_SKIP_AUTH === "true";

bootstrapApp(
  App,
  getAudioQnAAppEnv,
  onRefreshTokenFailed,
  import.meta.env.PROD,
  paths.chat,
  skipAuth,
);
