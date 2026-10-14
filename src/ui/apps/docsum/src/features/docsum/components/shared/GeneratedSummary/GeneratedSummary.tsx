// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  CopyButton,
  LoadingFallback,
} from "@intel-enterprise-rag-ui/components";
import { Markdown } from "@intel-enterprise-rag-ui/markdown";
import { useState } from "react";

import ExportActionDialog from "@/features/docsum/components/shared/ExportActionDialog/ExportActionDialog";
import ExportButton from "@/features/docsum/components/shared/ExportButton/ExportButton";

interface GeneratedSummaryProps {
  summary?: string;
  isLoading?: boolean;
  fileName?: string;
  data?: { text?: string };
  streamingText?: string;
}

const GeneratedSummary = ({
  summary,
  isLoading,
  fileName,
  streamingText,
}: GeneratedSummaryProps) => {
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  // Computed visibility states
  const isStreaming =
    isLoading &&
    streamingText !== undefined &&
    streamingText !== "" &&
    !summary;
  const displaySummary = isStreaming ? streamingText : summary;
  const hasContent = displaySummary !== undefined && displaySummary !== "";

  const showLoadingIndicator = isLoading && !streamingText;
  const showEmptyState = !hasContent;
  const showCopyButton = hasContent && !isStreaming;
  const showExportButton = hasContent && fileName && !isStreaming;
  const showExportDialog = hasContent && fileName && !isStreaming;

  const getContent = () => {
    if (showLoadingIndicator) {
      return (
        <div className="text-foreground flex h-full max-h-full min-h-0 w-full flex-1 items-center justify-center rounded bg-transparent px-4 text-sm dark:bg-transparent">
          <LoadingFallback loadingMessage="Generating your summary..." />
        </div>
      );
    }

    if (showEmptyState) {
      return (
        <p className="text-foreground bg-secondary flex h-full max-h-full min-h-0 w-full flex-1 items-center justify-center rounded px-4 text-center text-sm">
          Your summary will be displayed here
        </p>
      );
    }

    return (
      <div className="text-foreground bg-card border-border relative h-full max-h-full min-h-0 w-full flex-1 rounded border">
        <div
          className="generated-summary__content h-full max-h-full [scrollbar-gutter:stable] overflow-y-auto py-3 pr-14 pl-4 break-words whitespace-pre-wrap"
          data-testid="generated-summary-content"
        >
          <Markdown text={displaySummary ?? ""} />
        </div>
        {showCopyButton && (
          <span className="absolute top-0 right-0 mx-4 my-2">
            <CopyButton textToCopy={displaySummary ?? ""} />
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="grid h-full max-h-full grid-cols-1 grid-rows-[auto_1fr]">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-medium">Summary</p>
          {showExportButton && (
            <ExportButton onPress={() => setIsExportDialogOpen(true)} />
          )}
        </div>
        {getContent()}
      </div>
      {showExportDialog && (
        <ExportActionDialog
          summary={displaySummary ?? ""}
          fileName={fileName}
          isOpen={isExportDialogOpen}
          onOpenChange={setIsExportDialogOpen}
        />
      )}
    </>
  );
};

export default GeneratedSummary;
