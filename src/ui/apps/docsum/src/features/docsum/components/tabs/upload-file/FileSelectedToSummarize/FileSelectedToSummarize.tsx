// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Button } from "@intel-enterprise-rag-ui/components";
import { useMemo } from "react";

import { getFileIcon } from "@/features/docsum/utils/render";

interface FileSelectedToSummarizeProps {
  fileName: string;
  isGeneratingSummary: boolean;
  onChangeFile: () => void;
  onDeleteFile: () => void;
}

const FileSelectedToSummarize = ({
  fileName,
  isGeneratingSummary,
  onChangeFile,
  onDeleteFile,
}: FileSelectedToSummarizeProps) => {
  const icon = useMemo(() => getFileIcon(fileName), [fileName]);

  return (
    <div
      className="bg-secondary border-border text-foreground flex h-48 flex-col items-center justify-center gap-2 rounded border-2 px-16"
      data-testid="file-selected-to-summarize"
    >
      <span className="text-3xl">{icon}</span>
      <p className="text-center text-xl font-semibold">{fileName}</p>
      <div className="mt-2 flex items-center gap-2">
        <Button
          data-testid="change-file-button"
          size="sm"
          variant="outline"
          isDisabled={isGeneratingSummary}
          onPress={onChangeFile}
        >
          Change
        </Button>
        <Button
          data-testid="delete-file-button"
          variant="destructive"
          size="sm"
          isDisabled={isGeneratingSummary}
          onPress={onDeleteFile}
        >
          Delete
        </Button>
      </div>
    </div>
  );
};

export default FileSelectedToSummarize;
