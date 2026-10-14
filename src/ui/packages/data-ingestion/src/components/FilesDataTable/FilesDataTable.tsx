// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./FilesDataTable.css";

import {
  DataTable,
  IconButton,
  RowSelectionState,
  SearchBar,
  Tooltip,
} from "@intel-enterprise-rag-ui/components";
import {
  S3BucketIcon,
  SharePointSiteIcon,
} from "@intel-enterprise-rag-ui/icons";
import { useCallback, useMemo, useState } from "react";

import {
  useDeleteSharePointFileMutation,
  useGetFilesQuery,
  useGetSharePointSitesQuery,
  usePostSharePointFileUrlMutation,
  useRetryFileActionMutation,
} from "@/api/edpApi";
import BatchActionsDropdown from "@/components/BatchActionsDropdown/BatchActionsDropdown";
import BatchDeleteDialog from "@/components/BatchDeleteDialog/BatchDeleteDialog";
import RefreshButton from "@/components/RefreshButton/RefreshButton";
import useConditionalPolling from "@/hooks/useConditionalPolling";
import { selectIsAutorefreshEnabled } from "@/store/dataIngestionSettings.slice";
import { FileDataItem, GetFilePresignedUrl } from "@/types";
import { createFilesColumnDefs } from "@/utils/data-tables/files";

interface FilesDataTableProps {
  getAppEnv: (key: string) => string | undefined;
  getFilePresignedUrl: GetFilePresignedUrl;
  downloadFile: (args: { presignedUrl: string; fileName: string }) => void;
  deleteFile: (presignedUrl: string) => void;
}

const FilesDataTable = ({
  getAppEnv,
  getFilePresignedUrl,
  downloadFile,
  deleteFile,
}: FilesDataTableProps) => {
  const { data: files, refetch, isLoading } = useGetFilesQuery();
  useConditionalPolling(files, refetch, selectIsAutorefreshEnabled);

  const { data: spSites } = useGetSharePointSitesQuery();
  const sourceMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (spSites) {
      for (const site of spSites) {
        const displayName = site.display_name || site.name;
        map[displayName] = displayName;
      }
    }
    return map;
  }, [spSites]);

  const [retryFileAction] = useRetryFileActionMutation();
  const [postSharePointFileUrl] = usePostSharePointFileUrlMutation();
  const [deleteSharePointFile] = useDeleteSharePointFileMutation();
  const [filter, setFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  const downloadHandler = useCallback(
    async (
      fileName: string,
      bucketName: string | null,
      siteName: string | null,
    ) => {
      if (siteName) {
        const { data } = await postSharePointFileUrl({
          site_name: siteName,
          object_name: fileName,
        });

        if (data?.url) {
          window.open(data.url, "_blank", "noopener,noreferrer");
        }
        return;
      }

      if (!bucketName) return;

      const { data: presignedUrl } = await getFilePresignedUrl({
        fileName,
        method: "GET",
        bucketName,
      });

      if (presignedUrl) {
        downloadFile({ presignedUrl, fileName });
      }
    },
    [downloadFile, getFilePresignedUrl, postSharePointFileUrl],
  );

  const retryHandler = useCallback(
    (uuid: string) => {
      retryFileAction(uuid);
    },
    [retryFileAction],
  );

  const deleteHandler = useCallback(
    async (
      fileName: string,
      bucketName: string | null,
      siteName: string | null,
    ) => {
      if (siteName) {
        deleteSharePointFile({ site_name: siteName, object_name: fileName });
        return;
      }

      if (!bucketName) return;

      const { data: presignedUrl } = await getFilePresignedUrl({
        fileName,
        method: "DELETE",
        bucketName,
      });

      if (presignedUrl) {
        deleteFile(presignedUrl);
      }
    },
    [deleteFile, getFilePresignedUrl, deleteSharePointFile],
  );

  const defaultData = useMemo(() => {
    return files ?? [];
  }, [files]);

  const sourceFilterOptions = useMemo(() => {
    const sources = new Set<string>();
    defaultData.forEach(({ site_name, bucket_name }) => {
      const source = site_name || bucket_name;
      if (source) sources.add(source);
    });
    return Array.from(sources).sort();
  }, [defaultData]);

  const filesTableColumns = useMemo(
    () =>
      createFilesColumnDefs(getAppEnv, {
        downloadHandler,
        retryHandler,
        deleteHandler,
        sourceMap,
        sourceFilterOptions,
      }),
    [
      getAppEnv,
      deleteHandler,
      downloadHandler,
      retryHandler,
      sourceMap,
      sourceFilterOptions,
    ],
  );

  const selectedFiles = useMemo(() => {
    return Object.keys(rowSelection)
      .map((id) => defaultData.find((file) => file.id === id))
      .filter((file): file is FileDataItem => file !== undefined);
  }, [rowSelection, defaultData]);

  const retryableFiles = useMemo(() => {
    return selectedFiles.filter((file) => file.status === "error");
  }, [selectedFiles]);

  const reingestableFiles = useMemo(() => {
    const currentEmbeddingModel = getAppEnv(
      "EMBEDDING_MODEL_MIGRATION_NEW_MODEL",
    );
    if (!currentEmbeddingModel) return [];
    return selectedFiles.filter(
      (file) =>
        file.embedding_model !== currentEmbeddingModel &&
        file.status === "ingested",
    );
  }, [selectedFiles, getAppEnv]);

  const handleBatchRetry = useCallback(async () => {
    await Promise.all(retryableFiles.map((file) => retryFileAction(file.id)));
    setRowSelection({});
  }, [retryableFiles, retryFileAction]);

  const handleBatchReingest = useCallback(async () => {
    await Promise.all(
      reingestableFiles.map((file) => retryFileAction(file.id)),
    );
    setRowSelection({});
  }, [reingestableFiles, retryFileAction]);

  const handleBatchDelete = useCallback(async () => {
    await Promise.all(
      selectedFiles.map((file) =>
        deleteHandler(file.object_name, file.bucket_name, file.site_name),
      ),
    );
    setRowSelection({});
  }, [selectedFiles, deleteHandler]);

  const selectedFileNames = useMemo(() => {
    return selectedFiles.map((file) => file.object_name);
  }, [selectedFiles]);

  const getRowId = useCallback((row: FileDataItem) => row.id, []);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <div className="flex w-[6.5rem] items-center pl-16">
            <Tooltip
              title={showFilters ? "Hide filters" : "Show filters"}
              trigger={
                <IconButton
                  data-testid="files-toggle-filters-button"
                  icon={showFilters ? "filter" : "filter-active"}
                  size="sm"
                  variant="ghost"
                  aria-label={showFilters ? "Hide filters" : "Show filters"}
                  aria-pressed={showFilters}
                  onPress={() => setShowFilters((current) => !current)}
                />
              }
            />
          </div>
          <RefreshButton />
          <SearchBar
            data-testid="files-search-bar"
            value={filter}
            placeholder="Filter files by status, bucket, or name"
            onChange={setFilter}
            className="max-w-[500px]"
          />
        </div>
        {/* pr-16 matches the last column's pr-16 so the batch-actions button lines up with the
            Actions column instead of being pushed past TableViewLayout's bled-out right edge. */}
        <div className="flex items-center gap-4 pr-16">
          <BatchActionsDropdown
            selectedCount={selectedFiles.length}
            retryableCount={retryableFiles.length}
            reingestableCount={reingestableFiles.length}
            onRetry={handleBatchRetry}
            onReingest={handleBatchReingest}
            onDelete={() => setIsDeleteDialogOpen(true)}
          />
        </div>
      </div>
      {Object.keys(sourceMap).length > 0 && (
        <div className="text-foreground flex gap-4 px-2 py-1 text-xs">
          <span className="flex items-center gap-1">
            <S3BucketIcon aria-hidden="true" /> S3 Bucket
          </span>
          <span className="flex items-center gap-1">
            <SharePointSiteIcon aria-hidden="true" /> SharePoint Site
          </span>
        </div>
      )}
      <DataTable
        defaultData={defaultData}
        columns={filesTableColumns}
        isDataLoading={isLoading}
        globalFilter={filter}
        className="files-data-table data-table--plain-header"
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        getRowId={getRowId}
        showFilterRow={showFilters}
        enableRowSelection
        fillHeight
      />
      <BatchDeleteDialog
        isOpen={isDeleteDialogOpen}
        itemType="files"
        itemNames={selectedFileNames}
        onConfirm={handleBatchDelete}
        onClose={() => setIsDeleteDialogOpen(false)}
      />
    </div>
  );
};

export default FilesDataTable;
