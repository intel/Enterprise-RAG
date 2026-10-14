// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { IconButton, Tooltip } from "@intel-enterprise-rag-ui/components";
import { ColumnDef } from "@tanstack/react-table";

import ChunksProgress from "@/components/ChunksProgress/ChunksProgress";
import DataItemStatus from "@/components/DataItemStatus/DataItemStatus";
import LinkTextExtractionDialog from "@/components/debug/LinkTextExtractionDialog/LinkTextExtractionDialog";
import EmbeddingModelIndicator from "@/components/EmbeddingModelIndicator/EmbeddingModelIndicator";
import ProcessingTimePopover from "@/components/ProcessingTimePopover/ProcessingTimePopover";
import { LinkDataItem } from "@/types";

import { formatStatusForFilter, STATUS_FILTER_OPTIONS } from "./utils";

interface LinkActionsHandlers {
  retryHandler: (id: string) => void;
  deleteHandler: (id: string) => void;
}

// EMBEDDING_MODEL_MIGRATION_NEW_MODEL = current embedding model used by the system
// Links with a different model need to be re-ingested
export const createLinksColumnDefs = (
  getAppEnv: (key: string) => string | undefined,
  handlers: LinkActionsHandlers,
): ColumnDef<LinkDataItem>[] => {
  const currentEmbeddingModel = getAppEnv(
    "EMBEDDING_MODEL_MIGRATION_NEW_MODEL",
  );
  const { retryHandler, deleteHandler } = handlers;

  return [
    {
      accessorKey: "uri",
      header: "Link",
      meta: { pin: "left", filterVariant: "text" },
      cell: ({
        row: {
          original: { uri, embedding_model },
        },
      }) => {
        const tooltipContent = (
          <div className="text-xs">
            <p className="mb-1 font-semibold">Embedding Model</p>
            <p className="font-mono">{embedding_model || "unknown"}</p>
          </div>
        );

        return (
          <div className="flex items-center text-wrap [overflow-wrap:anywhere]">
            <EmbeddingModelIndicator
              itemEmbeddingModel={embedding_model}
              getAppEnv={getAppEnv}
            />
            <Tooltip
              title={tooltipContent}
              placement="top"
              trigger={<span className="cursor-help">{uri}</span>}
            />
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      accessorFn: (row) => formatStatusForFilter(row.status),
      filterFn: "equalsString",
      meta: { filterOptions: STATUS_FILTER_OPTIONS },
      cell: ({
        row: {
          original: { status, job_message: statusMessage },
        },
      }) => <DataItemStatus status={status} statusMessage={statusMessage} />,
    },
    {
      id: "chunks",
      header: "Chunks",
      enableGlobalFilter: false,
      cell: ({
        row: {
          original: {
            chunks_processed: processedChunks,
            chunks_total: totalChunks,
          },
        },
      }) => (
        <ChunksProgress
          processedChunks={processedChunks}
          totalChunks={totalChunks}
        />
      ),
    },
    {
      header: "Processing Time",
      enableGlobalFilter: false,
      cell: ({
        row: {
          original: {
            text_extractor_duration,
            text_compression_duration,
            text_splitter_duration,
            dpguard_duration,
            late_chunking_duration,
            embedding_duration,
            ingestion_duration,
            processing_duration,
            job_start_time,
            status,
          },
        },
      }) => (
        <ProcessingTimePopover
          textExtractorDuration={text_extractor_duration}
          textCompressionDuration={text_compression_duration}
          textSplitterDuration={text_splitter_duration}
          dpguardDuration={dpguard_duration}
          lateChunkingDuration={late_chunking_duration}
          embeddingDuration={embedding_duration}
          ingestionDuration={ingestion_duration}
          processingDuration={processing_duration}
          jobStartTime={job_start_time}
          dataStatus={status}
        />
      ),
    },
    {
      id: "actions",
      header: () => <p className="w-full text-center">Actions</p>,
      meta: { pin: "right" },
      cell: ({
        row: {
          original: { id, uri, status, embedding_model },
        },
      }) => {
        const needsReingest =
          currentEmbeddingModel &&
          embedding_model !== currentEmbeddingModel &&
          status === "ingested";

        return (
          <div className="flex items-center justify-end gap-2">
            <LinkTextExtractionDialog uuid={id} linkUri={uri} />
            {status === "error" && (
              <Tooltip
                title="Retry"
                trigger={
                  <IconButton
                    data-testid="retry-link-button"
                    icon="refresh"
                    size="sm"
                    variant="outline"
                    aria-label="Retry"
                    onPress={() => retryHandler(id)}
                  />
                }
              />
            )}
            {needsReingest && (
              <Tooltip
                title="Reingest"
                trigger={
                  <IconButton
                    data-testid="reingest-link-button"
                    icon="refresh"
                    size="sm"
                    variant="outline"
                    aria-label="Reingest"
                    onPress={() => retryHandler(id)}
                  />
                }
              />
            )}
            <Tooltip
              title="Delete"
              trigger={
                <IconButton
                  data-testid="delete-link-button"
                  icon="delete"
                  size="sm"
                  variant="destructive"
                  aria-label="Delete"
                  onPress={() => deleteHandler(id)}
                />
              }
            />
          </div>
        );
      },
    },
  ];
};
