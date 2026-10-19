// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./DataIngestionTab.css";

import { InfoIcon } from "@intel-enterprise-rag-ui/icons";

import BucketSynchronizationDialog from "@/components/BucketSynchronizationDialog/BucketSynchronizationDialog";
import DataIngestionSettingsDialog from "@/components/DataIngestionSettingsDialog/DataIngestionSettingsDialog";
import EmbeddingModelMigrationBanner from "@/components/EmbeddingModelMigrationBanner/EmbeddingModelMigrationBanner";
import FilesDataTable from "@/components/FilesDataTable/FilesDataTable";
import LinksDataTable from "@/components/LinksDataTable/LinksDataTable";
import RefreshButton from "@/components/RefreshButton/RefreshButton";
import S3CertificateAlertBanner from "@/components/S3CertificateAlertBanner/S3CertificateAlertBanner";
import SharePointSitesDialog from "@/components/SharePointSitesDialog/SharePointSitesDialog";
import UploadDataDialog from "@/components/UploadDataDialog/UploadDataDialog";
import useIsSharePointEnabled from "@/hooks/useIsSharePointEnabled";
import { GetFilePresignedUrl } from "@/types";

interface DataIngestionTabProps {
  getAppEnv: (key: string) => string | undefined;
  getFilePresignedUrl: GetFilePresignedUrl;
  downloadFile: (args: { presignedUrl: string; fileName: string }) => void;
  deleteFile: (presignedUrl: string) => void;
  postFile: (args: { url: string; file: File }) => Promise<{ error?: unknown }>;
  appApiErrors?: unknown[];
  onResetAppApiState?: () => void;
}

export const DataIngestionTab = ({
  getAppEnv,
  getFilePresignedUrl,
  downloadFile,
  deleteFile,
  postFile,
  appApiErrors,
  onResetAppApiState,
}: DataIngestionTabProps) => {
  const isSharePointEnabled = useIsSharePointEnabled();

  return (
    <div className="data-ingestion-tab">
      <div className="data-ingestion-tab__info-banner">
        <InfoIcon />
        <p>
          This interface is designed for lightweight administrative management:
          monitoring ingestion jobs, checking processing results, and adding
          small sample files or links when needed. For best performance and
          reliability, files should be uploaded directly to the configured
          storage endpoint (e.g., S3 bucket or SharePoint) rather than through
          the UI.
        </p>
      </div>
      <S3CertificateAlertBanner
        getAppEnv={getAppEnv}
        appApiErrors={appApiErrors}
        onResetAppApiState={onResetAppApiState}
      />
      <EmbeddingModelMigrationBanner getAppEnv={getAppEnv} />
      <header>
        <h2>Stored Data</h2>
        <div className="data-ingestion-tab__actions">
          <DataIngestionSettingsDialog />
          <RefreshButton />
          <BucketSynchronizationDialog />
          {isSharePointEnabled && <SharePointSitesDialog />}
          <UploadDataDialog
            getAppEnv={getAppEnv}
            getFilePresignedUrl={getFilePresignedUrl}
            postFile={postFile}
          />
        </div>
      </header>
      <section className="data-ingestion-tab__section">
        <h3>Files</h3>
        <FilesDataTable
          getAppEnv={getAppEnv}
          getFilePresignedUrl={getFilePresignedUrl}
          downloadFile={downloadFile}
          deleteFile={deleteFile}
        />
      </section>
      <section className="data-ingestion-tab__section">
        <h3>Links</h3>
        <LinksDataTable getAppEnv={getAppEnv} />
      </section>
    </div>
  );
};

export default DataIngestionTab;
