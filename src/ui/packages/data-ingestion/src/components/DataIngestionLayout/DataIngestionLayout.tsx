// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { InfoIcon } from "@intel-enterprise-rag-ui/icons";
import { Outlet } from "react-router-dom";

import EmbeddingModelMigrationBanner from "@/components/EmbeddingModelMigrationBanner/EmbeddingModelMigrationBanner";
import S3CertificateAlertBanner from "@/components/S3CertificateAlertBanner/S3CertificateAlertBanner";

export interface DataIngestionLayoutProps {
  getAppEnv: (key: string) => string | undefined;
  appApiErrors?: unknown[];
  onResetAppApiState?: () => void;
}

/**
 * Shared chrome for every Data Ingestion view (Ingested Files/Links, Upload Data, Bucket
 * Synchronization, Settings) — the info banner and error banners apply regardless of which view is
 * active, so they live here once rather than being duplicated per view.
 */
export const DataIngestionLayout = ({
  getAppEnv,
  appApiErrors,
  onResetAppApiState,
}: DataIngestionLayoutProps) => (
  <div className="flex h-full min-h-0 flex-col px-16 pt-6">
    <div className="bg-secondary border-border mb-4 flex shrink-0 items-start gap-3 rounded-md border px-4 py-3 text-sm">
      <InfoIcon className="text-foreground mt-0.5 shrink-0 text-base" />
      <p className="text-foreground">
        This interface is designed for lightweight administrative management:
        monitoring ingestion jobs, checking processing results, and adding small
        sample files or links when needed. For best performance and reliability,
        files should be uploaded directly to the configured storage endpoint
        (e.g., S3 bucket or SharePoint) rather than through the UI.
      </p>
    </div>
    <S3CertificateAlertBanner
      getAppEnv={getAppEnv}
      appApiErrors={appApiErrors}
      onResetAppApiState={onResetAppApiState}
    />
    <EmbeddingModelMigrationBanner getAppEnv={getAppEnv} />
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Outlet />
    </div>
  </div>
);

export default DataIngestionLayout;
