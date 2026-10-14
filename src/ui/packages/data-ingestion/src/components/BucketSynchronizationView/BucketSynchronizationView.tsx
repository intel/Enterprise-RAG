// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  Button,
  Checkbox,
  DataTable,
} from "@intel-enterprise-rag-ui/components";
import { IconName } from "@intel-enterprise-rag-ui/icons";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  useLazyGetFilesQuery,
  useLazyGetFilesSyncQuery,
  usePostFilesSyncMutation,
} from "@/api/edpApi";
import { ERROR_MESSAGES } from "@/config/api";
import { filesSyncColumns } from "@/utils/data-tables/filesSync";

export const BucketSynchronizationView = () => {
  const [showAllFiles, setShowAllFiles] = useState(false);

  const [
    getFilesSync,
    {
      currentData: getFilesSyncData,
      isFetching: isFetchingFilesSync,
      error: getFilesSyncError,
    },
  ] = useLazyGetFilesSyncQuery();
  const [getFiles] = useLazyGetFilesQuery();
  const [postFilesSync, { error: postFilesSyncError, isLoading }] =
    usePostFilesSyncMutation();

  useEffect(() => {
    getFilesSync();
    // Only on mount — this view replaces the dialog's "on open" trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filesSyncTableData = useMemo(() => {
    if (!getFilesSyncData) return [];
    return showAllFiles
      ? getFilesSyncData
      : getFilesSyncData.filter((item) => !item.action.includes("no action"));
  }, [getFilesSyncData, showAllFiles]);

  const hasActionableFiles = useMemo(
    () =>
      filesSyncTableData.some((item) =>
        ["add", "delete", "update"].includes(item.action),
      ),
    [filesSyncTableData],
  );

  const handleShowAllFilesCheckboxChange = () =>
    setShowAllFiles((prevValue) => !prevValue);

  const handleSynchronizeBtnPress = async () => {
    const { error } = await postFilesSync();

    if (!error) {
      toast.success("Successful bucket synchronization!");
      getFiles();
      getFilesSync();
    }
  };

  const btnContent = isLoading ? "Synchronizing..." : "Synchronize";
  const btnIcon: IconName | undefined = isLoading ? "loading" : undefined;
  const isSyncActionDisabled = !hasActionableFiles || isLoading;

  return (
    <section
      className="flex h-full min-h-0 flex-col pb-6 text-sm"
      data-testid="data-ingestion-bucket-sync-view"
    >
      <p className="mb-4 shrink-0">
        Below you can see files that need actions to be synchronized inside S3
        buckets.
        <br />
        Click &ldquo;Synchronize&ldquo; button to perform additions and
        deletions of actionable files listed below.
      </p>
      {getFilesSyncError ? (
        <p className="error">{ERROR_MESSAGES.GET_FILES_SYNC}</p>
      ) : (
        <>
          <Checkbox
            label="Show all files"
            size="sm"
            name="show-all-items"
            isSelected={showAllFiles}
            onChange={handleShowAllFilesCheckboxChange}
          />
          <DataTable
            defaultData={filesSyncTableData}
            columns={filesSyncColumns}
            isDataLoading={isFetchingFilesSync}
            dense
            fillHeight
          />
        </>
      )}
      <footer className="mt-4 flex shrink-0 items-center justify-end gap-4 text-sm">
        {!hasActionableFiles && <p>Manual synchronization is not required</p>}
        {postFilesSyncError && (
          <p className="error">{ERROR_MESSAGES.POST_FILES_SYNC}</p>
        )}
        <Button
          data-testid="synchronize-buckets-button"
          icon={btnIcon}
          isDisabled={isSyncActionDisabled}
          onPress={handleSynchronizeBtnPress}
        >
          {btnContent}
        </Button>
      </footer>
    </section>
  );
};

export default BucketSynchronizationView;
