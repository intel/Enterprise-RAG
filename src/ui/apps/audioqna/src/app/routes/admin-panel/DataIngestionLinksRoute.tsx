// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { LinksView } from "@intel-enterprise-rag-ui/data-ingestion";

import { AppEnvKey } from "@/types";
import { getAudioQnAAppEnv } from "@/utils";

const DataIngestionLinksRoute = () => (
  <LinksView getAppEnv={(key) => getAudioQnAAppEnv(key as AppEnvKey)} />
);

export default DataIngestionLinksRoute;
