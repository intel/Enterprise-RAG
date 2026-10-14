// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { IconButton, Tooltip } from "@intel-enterprise-rag-ui/components";
import {
  S3BucketIcon,
  SharePointSiteIcon,
} from "@intel-enterprise-rag-ui/icons";
import { formatFileSize } from "@intel-enterprise-rag-ui/utils";
import { ColumnDef } from "@tanstack/react-table";

import ChunksProgress from "@/components/ChunksProgress/ChunksProgress";
import DataItemStatus from "@/components/DataItemStatus/DataItemStatus";
import FileTextExtractionDialog from "@/components/debug/FileTextExtractionDialog/FileTextExtractionDialog";
import EmbeddingModelIndicator from "@/components/EmbeddingModelIndicator/EmbeddingModelIndicator";
import ProcessingTimePopover from "@/components/ProcessingTimePopover/ProcessingTimePopover";
import { FileDataItem } from "@/types";

import { formatStatusForFilter, STATUS_FILTER_OPTIONS } from "./utils";

// Upper bound for the "Size" column's range filter — files aren't expected to exceed this,
// so the slider's max end still means "no filtering", matching the other columns' "All" default.
const MAX_FILE_SIZE_FILTER_BYTES = 1024 * 1024 * 1024;

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
  sourceFilterOptions?: string[];
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
  const { downloadHandler, retryHandler, deleteHandler, sourceFilterOptions } =
    handlers;

  return [
    {
      accessorKey: "object_name",
      header: "Name",
      meta: { pin: "left", filterVariant: "text" },
      cell: ({
        row: {
          original: { object_name: fileName, embedding_model },
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
              trigger={<span className="cursor-help">{fileName}</span>}
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
      id: "source",
      header: "Source",
      accessorFn: (row) => row.site_name || row.bucket_name || "",
      filterFn: "equalsString",
      ...(sourceFilterOptions?.length && {
        meta: { filterOptions: sourceFilterOptions },
      }),
      cell: ({
        row: {
          original: { bucket_name, site_name },
        },
      }) => {
        if (site_name) {
          return (
            <span className="flex items-center gap-1">
              <SharePointSiteIcon aria-hidden="true" />
              {site_name}
            </span>
          );
        }
        return (
          <span className="flex items-center gap-1">
            <S3BucketIcon aria-hidden="true" />
            {bucket_name}
          </span>
        );
      },
    },
    {
      accessorKey: "size",
      header: "Size",
      enableGlobalFilter: false,
      filterFn: (row, columnId, maxSize: number) =>
        row.getValue<number>(columnId) <= maxSize,
      meta: {
        filterVariant: "range",
        filterRange: { min: 0, max: MAX_FILE_SIZE_FILTER_BYTES, step: 1024 },
      },
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
          <div className="flex items-center justify-end gap-2">
            <Tooltip
              title={site_name ? "Open" : "Download"}
              trigger={
                <IconButton
                  data-testid="download-file-button"
                  icon={site_name ? "external-link" : "download"}
                  size="sm"
                  variant="default"
                  aria-label={site_name ? "Open" : "Download"}
                  onPress={() =>
                    downloadHandler(object_name, bucket_name, site_name)
                  }
                />
              }
            />
            <FileTextExtractionDialog uuid={id} fileName={object_name} />
            {status === "error" && (
              <Tooltip
                title="Retry"
                trigger={
                  <IconButton
                    data-testid="retry-file-button"
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
                    data-testid="reingest-file-button"
                    icon="refresh"
                    size="sm"
                    variant="outline"
                    aria-label="Reingest"
                    onPress={() => retryHandler(id)}
                  />
                }
              />
            )}
            {(bucket_name || site_name) && (
              <Tooltip
                title="Delete"
                trigger={
                  <IconButton
                    data-testid="delete-file-button"
                    icon="delete"
                    size="sm"
                    variant="destructive"
                    aria-label="Delete"
                    onPress={() =>
                      deleteHandler(object_name, bucket_name, site_name)
                    }
                  />
                }
              />
            )}
          </div>
        );
      },
    },
  ];
};
