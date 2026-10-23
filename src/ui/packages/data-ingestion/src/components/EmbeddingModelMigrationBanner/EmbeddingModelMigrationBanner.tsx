// Copyright (C) 2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./EmbeddingModelMigrationBanner.css";

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
    <div className="embedding-model-migration-banner">
      <div className="embedding-model-migration-banner__body">
        <WarningIcon className="embedding-model-migration-banner__icon" />
        <div className="embedding-model-migration-banner__content">
          <div className="embedding-model-migration-banner__header">
            <h3 className="font-semibold">
              Action Required: Embedding Model Changed
            </h3>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="embedding-model-migration-banner__refresh-btn"
              title="Refresh migration status"
              aria-label="Refresh migration status"
            >
              <RefreshIcon
                className={`embedding-model-migration-banner__refresh-icon ${isFetching ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          <p className="embedding-model-migration-banner__description">
            The embedding model has been changed from{" "}
            <span className="embedding-model-migration-banner__model-name">
              {oldModel}
            </span>{" "}
            to{" "}
            <span className="embedding-model-migration-banner__model-name">
              {newModel}
            </span>
            . As a result, previously indexed documents are no longer compatible
            with the new embedding space and must be re-ingested to restore full
            search quality and availability.
          </p>

          {fileStats.total > 0 && fileStats.oldFiles > 0 && (
            <>
              <p className="embedding-model-migration-banner__stats">
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
              <p className="embedding-model-migration-banner__hint">
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
