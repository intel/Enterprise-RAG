// Copyright (C) 2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Button } from "@intel-enterprise-rag-ui/components";
import { RefreshIcon, WarningIcon } from "@intel-enterprise-rag-ui/icons";
import { useMemo, useState } from "react";

import {
  useGetFilesQuery,
  useGetLinksQuery,
  useRetryFileActionMutation,
  useRetryLinkActionMutation,
} from "@/api/edpApi";

/**
 * Displays a banner prompting re-ingestion when the embedding model has changed.
 *
 * Environment variables:
 * - EMBEDDING_MODEL_MIGRATION_REQUIRED - "true" shows the banner when out-of-date documents exist
 * - EMBEDDING_MODEL_MIGRATION_OLD_MODEL - name of the previous embedding model, shown in the banner text
 * - EMBEDDING_MODEL_MIGRATION_NEW_MODEL - name of the current embedding model documents must match
 */
interface EmbeddingModelMigrationBannerProps {
  getAppEnv: (key: string) => string | undefined;
}

const EmbeddingModelMigrationBanner = ({
  getAppEnv,
}: EmbeddingModelMigrationBannerProps) => {
  const migrationRequired =
    getAppEnv("EMBEDDING_MODEL_MIGRATION_REQUIRED") === "true";
  const oldModel = getAppEnv("EMBEDDING_MODEL_MIGRATION_OLD_MODEL");
  const newModel = getAppEnv("EMBEDDING_MODEL_MIGRATION_NEW_MODEL");

  const {
    data: files,
    isLoading: filesLoading,
    refetch: refetchFiles,
    isFetching: filesFetching,
  } = useGetFilesQuery(undefined, {
    skip: !migrationRequired,
    pollingInterval: 30000,
  });

  const {
    data: links,
    isLoading: linksLoading,
    refetch: refetchLinks,
    isFetching: linksFetching,
  } = useGetLinksQuery(undefined, {
    skip: !migrationRequired,
    pollingInterval: 30000,
  });

  const isLoading = filesLoading || linksLoading;
  const isFetching = filesFetching || linksFetching;

  const [retryFileAction] = useRetryFileActionMutation();
  const [retryLinkAction] = useRetryLinkActionMutation();
  const [isReingesting, setIsReingesting] = useState(false);

  const refetch = () => {
    refetchFiles();
    refetchLinks();
  };

  const handleReingestAll = async () => {
    if (isReingesting) return;

    setIsReingesting(true);
    try {
      const fileItems = (files || []).filter(
        (file) => file.embedding_model !== newModel,
      );
      const linkItems = (links || []).filter(
        (link) => link.embedding_model !== newModel,
      );

      for (const file of fileItems) {
        try {
          await retryFileAction(file.id).unwrap();
        } catch (error) {
          console.error(`Failed to reingest file ${file.id}:`, error);
        }
      }

      for (const link of linkItems) {
        try {
          await retryLinkAction(link.id).unwrap();
        } catch (error) {
          console.error(`Failed to reingest link ${link.id}:`, error);
        }
      }

      refetch();
    } finally {
      setIsReingesting(false);
    }
  };

  const fileStats = useMemo(() => {
    if (!newModel) {
      return { total: 0, oldFiles: 0 };
    }

    const allItems = [...(files || []), ...(links || [])];

    const total = allItems.length;

    const oldFiles = allItems.filter(
      (item) => item.embedding_model !== newModel,
    ).length;

    return { total, oldFiles };
  }, [files, links, newModel]);

  if (!migrationRequired || fileStats.total === 0 || fileStats.oldFiles === 0) {
    return null;
  }

  if (isLoading) {
    return null;
  }

  return (
    <div className="bg-secondary border-border mb-4 rounded-md border px-4 py-3 text-sm">
      <div className="flex items-start gap-3">
        <WarningIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">
              Action Required: Embedding Model Changed
            </h3>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="hover:bg-accent ml-2 rounded p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              title="Refresh migration status"
              aria-label="Refresh migration status"
            >
              <RefreshIcon
                className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          <p className="mb-2">
            The embedding model has been changed from{" "}
            <span className="font-semibold">{oldModel}</span> to{" "}
            <span className="font-semibold">{newModel}</span>. As a result,
            previously indexed documents are no longer compatible with the new
            embedding space and must be re-ingested to restore full search
            quality and availability.
          </p>

          {fileStats.total > 0 && fileStats.oldFiles > 0 && (
            <>
              <p className="mb-3 font-medium">
                Documents needed to be re-ingested:{" "}
                <strong>{fileStats.oldFiles}</strong>
              </p>
              <Button
                size="sm"
                onPress={handleReingestAll}
                isDisabled={isReingesting}
              >
                {isReingesting ? "Reingesting..." : "Reingest All"}
              </Button>
              <p className="mt-3 text-left text-xs opacity-80">
                This banner will automatically disappear once all documents have
                been re-ingested.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmbeddingModelMigrationBanner;
