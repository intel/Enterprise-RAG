// Copyright (C) 2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./EmbeddingModelIndicator.css";

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
      className="embedding-model-indicator__trigger"
      aria-label="Re-ingestion Required"
    >
      <WarningIcon className="embedding-model-indicator__trigger-icon" />
    </span>
  );

  const tooltipContent = (
    <div className="embedding-model-indicator__tooltip">
      <p className="embedding-model-indicator__tooltip-title">
        Re-ingestion Required
      </p>
      <p className="embedding-model-indicator__tooltip-text">
        This item uses an outdated embedding model and needs to be re-ingested.
      </p>
      <p className="embedding-model-indicator__tooltip-meta">
        Current model:{" "}
        <span className="embedding-model-indicator__model-name">
          {itemEmbeddingModel || "unknown"}
        </span>
      </p>
      <p className="embedding-model-indicator__tooltip-meta">
        Expected model:{" "}
        <span className="embedding-model-indicator__model-name">
          {currentEmbeddingModel}
        </span>
      </p>
      <p className="embedding-model-indicator__tooltip-hint">
        Use the &quot;Reingest&quot; action to update it.
      </p>
    </div>
  );

  return (
    <Tooltip title={tooltipContent} trigger={indicator} placement="right" />
  );
};

export default EmbeddingModelIndicator;
