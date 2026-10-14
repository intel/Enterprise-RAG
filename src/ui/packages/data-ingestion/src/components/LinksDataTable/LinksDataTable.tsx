// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./LinksDataTable.css";

import {
  DataTable,
  IconButton,
  RowSelectionState,
  SearchBar,
  Tooltip,
} from "@intel-enterprise-rag-ui/components";
import { useCallback, useMemo, useState } from "react";

import {
  useDeleteLinkMutation,
  useGetLinksQuery,
  useRetryLinkActionMutation,
} from "@/api/edpApi";
import BatchActionsDropdown from "@/components/BatchActionsDropdown/BatchActionsDropdown";
import BatchDeleteDialog from "@/components/BatchDeleteDialog/BatchDeleteDialog";
import RefreshButton from "@/components/RefreshButton/RefreshButton";
import useConditionalPolling from "@/hooks/useConditionalPolling";
import { selectIsAutorefreshEnabled } from "@/store/dataIngestionSettings.slice";
import { LinkDataItem } from "@/types";
import { createLinksColumnDefs } from "@/utils/data-tables/links";

interface LinksDataTableProps {
  getAppEnv: (key: string) => string | undefined;
}

const LinksDataTable = ({ getAppEnv }: LinksDataTableProps) => {
  const { data: links, refetch, isLoading } = useGetLinksQuery();
  useConditionalPolling(links, refetch, selectIsAutorefreshEnabled);

  const [deleteLink] = useDeleteLinkMutation();
  const [retryLinkAction] = useRetryLinkActionMutation();
  const [filter, setFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  const retryHandler = useCallback(
    (uuid: string) => {
      retryLinkAction(uuid);
    },
    [retryLinkAction],
  );

  const deleteHandler = useCallback(
    (uuid: string) => {
      deleteLink(uuid);
    },
    [deleteLink],
  );

  const defaultData = useMemo(() => {
    return links || [];
  }, [links]);

  const linksTableColumns = useMemo(
    () =>
      createLinksColumnDefs(getAppEnv, {
        retryHandler,
        deleteHandler,
      }),
    [getAppEnv, retryHandler, deleteHandler],
  );

  const selectedLinks = useMemo(() => {
    return Object.keys(rowSelection)
      .map((id) => defaultData.find((link) => link.id === id))
      .filter((link): link is LinkDataItem => link !== undefined);
  }, [rowSelection, defaultData]);

  const retryableLinks = useMemo(() => {
    return selectedLinks.filter((link) => link.status === "error");
  }, [selectedLinks]);

  const reingestableLinks = useMemo(() => {
    const currentEmbeddingModel = getAppEnv(
      "EMBEDDING_MODEL_MIGRATION_NEW_MODEL",
    );
    if (!currentEmbeddingModel) return [];
    return selectedLinks.filter(
      (link) =>
        link.embedding_model !== currentEmbeddingModel &&
        link.status === "ingested",
    );
  }, [selectedLinks, getAppEnv]);

  const handleBatchRetry = useCallback(async () => {
    await Promise.all(retryableLinks.map((link) => retryLinkAction(link.id)));
    setRowSelection({});
  }, [retryableLinks, retryLinkAction]);

  const handleBatchReingest = useCallback(async () => {
    await Promise.all(
      reingestableLinks.map((link) => retryLinkAction(link.id)),
    );
    setRowSelection({});
  }, [reingestableLinks, retryLinkAction]);

  const handleBatchDelete = useCallback(async () => {
    await Promise.all(selectedLinks.map((link) => deleteLink(link.id)));
    setRowSelection({});
  }, [selectedLinks, deleteLink]);

  const selectedLinkNames = useMemo(() => {
    return selectedLinks.map((link) => link.uri);
  }, [selectedLinks]);

  const getRowId = useCallback((row: LinkDataItem) => row.id, []);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <div className="flex w-[6.5rem] items-center pl-16">
            <Tooltip
              title={showFilters ? "Hide filters" : "Show filters"}
              trigger={
                <IconButton
                  data-testid="links-toggle-filters-button"
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
            data-testid="links-search-bar"
            value={filter}
            placeholder="Filter links by status or link"
            onChange={setFilter}
            className="max-w-[500px]"
          />
        </div>
        {/* pr-16 matches the last column's pr-16 so the batch-actions button lines up with the
            Actions column instead of being pushed past TableViewLayout's bled-out right edge. */}
        <div className="flex items-center gap-4 pr-16">
          <BatchActionsDropdown
            selectedCount={selectedLinks.length}
            retryableCount={retryableLinks.length}
            reingestableCount={reingestableLinks.length}
            onRetry={handleBatchRetry}
            onReingest={handleBatchReingest}
            onDelete={() => setIsDeleteDialogOpen(true)}
          />
        </div>
      </div>
      <DataTable
        defaultData={defaultData}
        columns={linksTableColumns}
        isDataLoading={isLoading}
        globalFilter={filter}
        className="links-data-table data-table--plain-header"
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        getRowId={getRowId}
        showFilterRow={showFilters}
        enableRowSelection
        fillHeight
      />
      <BatchDeleteDialog
        isOpen={isDeleteDialogOpen}
        itemType="links"
        itemNames={selectedLinkNames}
        onConfirm={handleBatchDelete}
        onClose={() => setIsDeleteDialogOpen(false)}
      />
    </div>
  );
};

export default LinksDataTable;
