// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./ChunksProgressBar.css";

import { ProgressBar } from "@intel-enterprise-rag-ui/components";
import { memo } from "react";

interface ChunksProgressBarProps {
  processedChunks: number;
  totalChunks: number;
}

const ChunksProgressBar = memo(
  ({ processedChunks, totalChunks }: ChunksProgressBarProps) => {
    const percentValue =
      totalChunks > 0 ? Math.round((processedChunks / totalChunks) * 100) : 0;

    return (
      <div className="chunks-progress-bar">
        <ProgressBar
          data-testid="chunks-progress-bar"
          value={processedChunks}
          maxValue={totalChunks}
          aria-label="Processed Chunks"
        />
        <p className="chunks-progress-bar__count">
          {processedChunks}&nbsp;/&nbsp;{totalChunks}&nbsp;({percentValue}%)
        </p>
      </div>
    );
  },
);

ChunksProgressBar.displayName = "ChunksProgressBar";

export default ChunksProgressBar;
