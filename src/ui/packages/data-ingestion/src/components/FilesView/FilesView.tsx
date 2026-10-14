// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import FilesDataTable from "@/components/FilesDataTable/FilesDataTable";
import { GetFilePresignedUrl } from "@/types";

export interface FilesViewProps {
  getAppEnv: (key: string) => string | undefined;
  getFilePresignedUrl: GetFilePresignedUrl;
  downloadFile: (args: { presignedUrl: string; fileName: string }) => void;
  deleteFile: (presignedUrl: string) => void;
}

export const FilesView = ({
  getAppEnv,
  getFilePresignedUrl,
  downloadFile,
  deleteFile,
}: FilesViewProps) => (
  <section
    className="flex h-full min-h-0 flex-col pb-6"
    data-testid="data-ingestion-files-view"
  >
    <FilesDataTable
      getAppEnv={getAppEnv}
      getFilePresignedUrl={getFilePresignedUrl}
      downloadFile={downloadFile}
      deleteFile={deleteFile}
    />
  </section>
);

export default FilesView;
