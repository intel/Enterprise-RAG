// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./index.css";

import { bootstrapApp } from "@intel-enterprise-rag-ui/layouts";

import App from "@/app";
import { getDocSumAppEnv } from "@/utils";
import { onRefreshTokenFailed } from "@/utils/api";

bootstrapApp(App, getDocSumAppEnv, onRefreshTokenFailed, import.meta.env.PROD);
