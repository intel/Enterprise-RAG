// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { DataStatus } from "@/types";

export const formatStatusForFilter = (status: string): string =>
  status
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const DATA_STATUSES: DataStatus[] = [
  "uploaded",
  "error",
  "processing",
  "text_extracting",
  "text_compression",
  "text_splitting",
  "dpguard",
  "late_chunking",
  "embedding",
  "ingested",
  "deleting",
  "canceled",
  "blocked",
];

export const STATUS_FILTER_OPTIONS = DATA_STATUSES.map(formatStatusForFilter);
