// Copyright (C) 2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./SharePointSitesDialog.css";

import {
  Button,
  Checkbox,
  DataTable,
  Dialog,
  DialogRef,
  IconButton,
  Tooltip,
} from "@intel-enterprise-rag-ui/components";
import { IconName } from "@intel-enterprise-rag-ui/icons";
import { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  useDeleteSharePointSiteMutation,
  useLazyGetSharePointSitesQuery,
  useLazyGetSharePointSyncQuery,
  usePostSharePointSyncMutation,
} from "@/api/edpApi";
import AddSharePointSiteForm from "@/components/AddSharePointSiteForm/AddSharePointSiteForm";
import { ERROR_MESSAGES } from "@/config/api";
import { SharePointSiteItem } from "@/types/api";
import {
  sharePointSitesColumns,
  sharePointSyncColumns,
} from "@/utils/data-tables/sharepoint";

const SharePointSitesDialog = () => {
  const [
    getSharePointSites,
    {
      currentData: sitesData,
      isFetching: isFetchingSites,
      error: getSitesError,
    },
  ] = useLazyGetSharePointSitesQuery();

  const [
    getSharePointSync,
    { currentData: syncData, isFetching: isFetchingSync, error: getSyncError },
  ] = useLazyGetSharePointSyncQuery();

  const [postSharePointSync, { isLoading: isSyncing }] =
    usePostSharePointSyncMutation();

  const [deleteSharePointSite] = useDeleteSharePointSiteMutation();

  const [showAllFiles, setShowAllFiles] = useState(false);
  const [disconnectingSiteId, setDisconnectingSiteId] = useState<string | null>(
    null,
  );

  const dialogRef = useRef<DialogRef>(null);

  const handleDisconnectSite = useCallback(
    async (siteId: string) => {
      setDisconnectingSiteId(siteId);
      const { error } = await deleteSharePointSite(siteId);
      setDisconnectingSiteId(null);
      if (!error) {
        toast.success("SharePoint site disconnected successfully.");
        getSharePointSites();
      }
    },
    [deleteSharePointSite, getSharePointSites],
  );

  const sitesColumns = useMemo<ColumnDef<SharePointSiteItem>[]>(
    () => [
      ...sharePointSitesColumns,
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const isDisconnecting = disconnectingSiteId === row.original.id;
          return (
            <Button
              data-testid={`disconnect-sp-site-${row.original.id}`}
              variant="ghost"
              size="sm"
              isDisabled={isDisconnecting}
              onPress={() => handleDisconnectSite(row.original.id)}
            >
              {isDisconnecting ? "Disconnecting..." : "Disconnect"}
            </Button>
          );
        },
        size: 120,
      },
    ],
    [disconnectingSiteId, handleDisconnectSite],
  );

  const onSiteAdded = () => {
    toast.success("SharePoint site added successfully!");
    getSharePointSites();
    getSharePointSync();
  };

  const sitesTableData = useMemo(() => sitesData ?? [], [sitesData]);

  const syncTableData = useMemo(() => {
    if (!syncData) return [];
    return showAllFiles
      ? syncData
      : syncData.filter((item) => item.action !== "no action");
  }, [syncData, showAllFiles]);

  const hasActionableFiles = useMemo(
    () =>
      syncTableData.some((item) =>
        ["add", "delete", "update"].includes(item.action),
      ),
    [syncTableData],
  );

  const handleSynchronize = async () => {
    const { error } = await postSharePointSync();

    if (error) {
      const status = (error as { status?: number }).status;
      if (status === 409) {
        toast.error(
          "SharePoint synchronization is already in progress. Please wait and try again.",
        );
      }
      return;
    }

    dialogRef.current?.close();
    toast.success("SharePoint files synchronized successfully!");
  };

  const dialogTrigger = useMemo(() => {
    const handleDialogTriggerPress = () => {
      getSharePointSites();
      getSharePointSync();
    };

    return (
      <Tooltip
        title="SharePoint Sites"
        trigger={
          <IconButton
            data-testid="trigger-sharepoint-sites-button"
            variant="outline"
            icon="link"
            onPress={handleDialogTriggerPress}
          />
        }
      />
    );
  }, [getSharePointSites, getSharePointSync]);

  const sitesContent = useMemo(
    () =>
      getSitesError ? (
        <p className="error">{ERROR_MESSAGES.GET_SHAREPOINT_SITES}</p>
      ) : (
        <DataTable
          defaultData={sitesTableData}
          columns={sitesColumns}
          isDataLoading={isFetchingSites}
          className="sharepoint-sites-dialog__sites-table"
          dense
        />
      ),
    [getSitesError, sitesTableData, sitesColumns, isFetchingSites],
  );

  const syncBtnContent = isFetchingSync ? "Checking..." : "Check for updates";
  const syncBtnIcon: IconName | undefined = isFetchingSync
    ? "loading"
    : undefined;

  const syncFooterBtnContent = isSyncing ? "Synchronizing..." : "Synchronize";
  const syncFooterBtnIcon: IconName | undefined = isSyncing
    ? "loading"
    : undefined;

  return (
    <Dialog
      ref={dialogRef}
      data-testid="sharepoint-sites-dialog"
      trigger={dialogTrigger}
      title="SharePoint Sites"
      footer={
        syncData && (
          <footer className="flex items-center justify-end gap-4 text-sm">
            {!hasActionableFiles && (
              <p>Manual synchronization is not required</p>
            )}
            {getSyncError && (
              <p className="error">{ERROR_MESSAGES.POST_SHAREPOINT_SYNC}</p>
            )}
            <Button
              data-testid="synchronize-sharepoint-button"
              icon={syncFooterBtnIcon}
              isDisabled={!hasActionableFiles || isSyncing}
              onPress={handleSynchronize}
            >
              {syncFooterBtnContent}
            </Button>
          </footer>
        )
      }
    >
      <div className="h-full w-full text-sm">
        <p className="mb-4">
          Below you can see the SharePoint sites that are registered for
          synchronization.
          <br />
          Enter a SharePoint site URL to add it to the list.
        </p>
        <AddSharePointSiteForm onSiteAdded={onSiteAdded} />
        {sitesContent}

        <div className="sharepoint-sites-dialog__sync-section border-border mt-6 border-t pt-4">
          <h4 className="mb-2 text-base font-semibold">File Synchronization</h4>
          <p className="mb-3">
            Check for file changes across all tracked SharePoint sites. Each
            site is stored in its own bucket for clear separation.
          </p>
          <Button
            data-testid="check-sharepoint-sync-button"
            variant="outline"
            icon={syncBtnIcon}
            isDisabled={isFetchingSync}
            onPress={() => getSharePointSync()}
          >
            {syncBtnContent}
          </Button>
          {syncData && (
            <div className="mt-3">
              <Checkbox
                label="Show all files"
                size="sm"
                name="show-all-sp-files"
                isSelected={showAllFiles}
                onChange={() => setShowAllFiles((v) => !v)}
              />
              <DataTable
                defaultData={syncTableData}
                columns={sharePointSyncColumns}
                isDataLoading={isFetchingSync}
                dense
              />
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};

export default SharePointSitesDialog;
