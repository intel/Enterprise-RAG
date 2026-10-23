// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./dataTableCells.css";

import { Button, Tooltip } from "@intel-enterprise-rag-ui/components";
import { ColumnDef } from "@tanstack/react-table";

import ChunksProgressBar from "@/components/ChunksProgressBar/ChunksProgressBar";
import DataItemStatus from "@/components/DataItemStatus/DataItemStatus";
import LinkTextExtractionDialog from "@/components/debug/LinkTextExtractionDialog/LinkTextExtractionDialog";
import EmbeddingModelIndicator from "@/components/EmbeddingModelIndicator/EmbeddingModelIndicator";
import ProcessingTimePopover from "@/components/ProcessingTimePopover/ProcessingTimePopover";
import { LinkDataItem } from "@/types";

import { formatStatusForFilter } from "./utils";

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
      accessorKey: "status",
      header: "Status",
      accessorFn: (row) => formatStatusForFilter(row.status),
      cell: ({
        row: {
          original: { status, job_message: statusMessage },
        },
      }) => <DataItemStatus status={status} statusMessage={statusMessage} />,
    },
    {
      accessorKey: "uri",
      header: "Link",
      cell: ({
        row: {
          original: { uri, embedding_model },
        },
      }) => {
        const tooltipContent = (
          <div className="data-table-cell__tooltip">
            <p className="data-table-cell__tooltip-title">Embedding Model</p>
            <p className="data-table-cell__tooltip-value">
              {embedding_model || "unknown"}
            </p>
          </div>
        );

        return (
          <div className="data-table-cell__name">
            <EmbeddingModelIndicator
              itemEmbeddingModel={embedding_model}
              getAppEnv={getAppEnv}
            />
            <Tooltip
              title={tooltipContent}
              placement="top"
              trigger={
                <span className="data-table-cell__name-trigger">{uri}</span>
              }
            />
          </div>
        );
      },
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
        <ChunksProgressBar
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
      header: () => <p className="data-table-cell__actions-header">Actions</p>,
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
          <div className="data-table-cell__actions">
            <LinkTextExtractionDialog uuid={id} linkUri={uri} />
            {status === "error" && (
              <Button
                data-testid="retry-link-button"
                size="sm"
                variant="outlined"
                onPress={() => retryHandler(id)}
              >
                Retry
              </Button>
            )}
            {needsReingest && (
              <Button
                data-testid="reingest-link-button"
                size="sm"
                variant="outlined"
                onPress={() => retryHandler(id)}
              >
                Reingest
              </Button>
            )}
            <Button
              data-testid="delete-link-button"
              size="sm"
              color="error"
              onPress={() => deleteHandler(id)}
            >
              Delete
            </Button>
          </div>
        );
      },
    },
  ];
};
