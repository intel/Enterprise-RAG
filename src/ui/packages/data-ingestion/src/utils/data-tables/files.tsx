// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./dataTableCells.css";

import { Button, Tooltip } from "@intel-enterprise-rag-ui/components";
import {
  S3BucketIcon,
  SharePointSiteIcon,
} from "@intel-enterprise-rag-ui/icons";
import { formatFileSize } from "@intel-enterprise-rag-ui/utils";
import { ColumnDef } from "@tanstack/react-table";

import ChunksProgressBar from "@/components/ChunksProgressBar/ChunksProgressBar";
import DataItemStatus from "@/components/DataItemStatus/DataItemStatus";
import FileTextExtractionDialog from "@/components/debug/FileTextExtractionDialog/FileTextExtractionDialog";
import EmbeddingModelIndicator from "@/components/EmbeddingModelIndicator/EmbeddingModelIndicator";
import ProcessingTimePopover from "@/components/ProcessingTimePopover/ProcessingTimePopover";
import { FileDataItem } from "@/types";

import { formatStatusForFilter } from "./utils";

interface FileActionsHandlers {
  downloadHandler: (
    name: string,
    bucketName: string | null,
    siteName: string | null,
  ) => void;
  retryHandler: (id: string) => void;
  deleteHandler: (
    name: string,
    bucketName: string | null,
    siteName: string | null,
  ) => void;
  sourceMap?: Record<string, string>;
}

// EMBEDDING_MODEL_MIGRATION_NEW_MODEL = current embedding model used by the system
// Files with a different model need to be re-ingested
export const createFilesColumnDefs = (
  getAppEnv: (key: string) => string | undefined,
  handlers: FileActionsHandlers,
): ColumnDef<FileDataItem>[] => {
  const currentEmbeddingModel = getAppEnv(
    "EMBEDDING_MODEL_MIGRATION_NEW_MODEL",
  );
  const { downloadHandler, retryHandler, deleteHandler } = handlers;

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
      accessorKey: "bucket_name",
      header: "Source",
      cell: ({
        row: {
          original: { bucket_name, site_name },
        },
      }) => {
        if (site_name) {
          return (
            <span className="data-table-cell__icon-label">
              <SharePointSiteIcon aria-hidden="true" />
              {site_name}
            </span>
          );
        }
        return (
          <span className="data-table-cell__icon-label">
            <S3BucketIcon aria-hidden="true" />
            {bucket_name}
          </span>
        );
      },
    },
    {
      accessorKey: "object_name",
      header: "Name",
      cell: ({
        row: {
          original: { object_name: fileName, embedding_model },
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
                <span className="data-table-cell__name-trigger">
                  {fileName}
                </span>
              }
            />
          </div>
        );
      },
    },
    {
      accessorKey: "size",
      header: "Size",
      enableGlobalFilter: false,
      cell: ({ row }) => formatFileSize(row.getValue("size")),
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
          original: {
            object_name,
            status,
            id,
            bucket_name,
            site_name,
            embedding_model,
          },
        },
      }) => {
        const needsReingest =
          currentEmbeddingModel &&
          embedding_model !== currentEmbeddingModel &&
          status === "ingested";

        return (
          <div className="data-table-cell__actions">
            <Button
              data-testid="download-file-button"
              size="sm"
              onPress={() =>
                downloadHandler(object_name, bucket_name, site_name)
              }
            >
              {site_name ? "Open" : "Download"}
            </Button>
            <FileTextExtractionDialog uuid={id} fileName={object_name} />
            {status === "error" && (
              <Button
                data-testid="retry-file-button"
                size="sm"
                variant="outlined"
                onPress={() => retryHandler(id)}
              >
                Retry
              </Button>
            )}
            {needsReingest && (
              <Button
                data-testid="reingest-file-button"
                size="sm"
                variant="outlined"
                onPress={() => retryHandler(id)}
              >
                Reingest
              </Button>
            )}
            {(bucket_name || site_name) && (
              <Button
                data-testid="delete-file-button"
                size="sm"
                color="error"
                onPress={() =>
                  deleteHandler(object_name, bucket_name, site_name)
                }
              >
                Delete
              </Button>
            )}
          </div>
        );
      },
    },
  ];
};
