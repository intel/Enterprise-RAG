// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { LinksView } from "@intel-enterprise-rag-ui/data-ingestion";

import { AppEnvKey } from "@/types";
import { getChatQnAAppEnv } from "@/utils";

const DataIngestionLinksRoute = () => (
  <LinksView getAppEnv={(key) => getChatQnAAppEnv(key as AppEnvKey)} />
);

export default DataIngestionLinksRoute;
