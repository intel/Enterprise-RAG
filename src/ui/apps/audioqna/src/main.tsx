// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./index.css";

import { bootstrapApp } from "@intel-enterprise-rag-ui/layouts";

import App from "@/app";
import { paths } from "@/config/paths";
import { getAudioQnAAppEnv } from "@/utils";
import { onRefreshTokenFailed } from "@/utils/api";

bootstrapApp(
  App,
  getAudioQnAAppEnv,
  onRefreshTokenFailed,
  import.meta.env.PROD,
  paths.chat,
);
