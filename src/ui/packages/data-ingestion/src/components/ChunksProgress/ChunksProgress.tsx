// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Progress } from "@intel-enterprise-rag-ui/components";
import { memo } from "react";

interface ChunksProgressProps {
  processedChunks: number;
  totalChunks: number;
}

const ChunksProgress = memo(
  ({ processedChunks, totalChunks }: ChunksProgressProps) => {
    const percentValue =
      totalChunks > 0 ? Math.round((processedChunks / totalChunks) * 100) : 0;

    return (
      <div className="flex flex-nowrap items-center gap-2">
        <Progress
          data-testid="chunks-progress-bar"
          value={processedChunks}
          maxValue={totalChunks}
          aria-label="Processed Chunks"
        />
        <p className="text-xs">
          {processedChunks}&nbsp;/&nbsp;{totalChunks}&nbsp;({percentValue}%)
        </p>
      </div>
    );
  },
);

ChunksProgress.displayName = "ChunksProgress";

export default ChunksProgress;
