// Copyright (C) 2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Tooltip } from "@intel-enterprise-rag-ui/components";
import { WarningIcon } from "@intel-enterprise-rag-ui/icons";

interface EmbeddingModelIndicatorProps {
  itemEmbeddingModel: string | null;
  getAppEnv: (key: string) => string | undefined;
}

const EmbeddingModelIndicator = ({
  itemEmbeddingModel,
  getAppEnv,
}: EmbeddingModelIndicatorProps) => {
  const currentEmbeddingModel = getAppEnv(
    "EMBEDDING_MODEL_MIGRATION_NEW_MODEL",
  );
  const migrationRequired =
    getAppEnv("EMBEDDING_MODEL_MIGRATION_REQUIRED") === "true";

  if (!migrationRequired) {
    return null;
  }

  if (!currentEmbeddingModel) {
    return null;
  }

  if (itemEmbeddingModel === currentEmbeddingModel) {
    return null;
  }

  const indicator = (
    <span
      className="mr-2 inline-flex cursor-help items-center justify-center text-amber-600 dark:text-amber-400"
      aria-label="Re-ingestion Required"
    >
      <WarningIcon className="h-4 w-4" />
    </span>
  );

  const tooltipContent = (
    <div className="text-sm">
      <p className="mb-1 font-semibold">Re-ingestion Required</p>
      <p className="mb-1">
        This item uses an outdated embedding model and needs to be re-ingested.
      </p>
      <p className="text-xs">
        Current model:{" "}
        <span className="font-mono">{itemEmbeddingModel || "unknown"}</span>
      </p>
      <p className="text-xs">
        Expected model:{" "}
        <span className="font-mono">{currentEmbeddingModel}</span>
      </p>
      <p className="mt-2 text-xs opacity-80">
        Use the &quot;Reingest&quot; action to update it.
      </p>
    </div>
  );

  return (
    <Tooltip title={tooltipContent} trigger={indicator} placement="right" />
  );
};

export default EmbeddingModelIndicator;
