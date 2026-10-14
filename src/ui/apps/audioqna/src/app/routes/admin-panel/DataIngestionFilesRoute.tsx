// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { FilesView } from "@intel-enterprise-rag-ui/data-ingestion";

import {
  useGetFilePresignedUrlMutation,
  useLazyDownloadFileQuery,
} from "@/api";
import { useDeleteFileMutation } from "@/features/admin-panel/data-ingestion/api/s3Api";
import { AppEnvKey } from "@/types";
import { getAudioQnAAppEnv } from "@/utils";

const DataIngestionFilesRoute = () => {
  const [getFilePresignedUrl] = useGetFilePresignedUrlMutation();
  const [downloadFile] = useLazyDownloadFileQuery();
  const [deleteFile] = useDeleteFileMutation();

  return (
    <FilesView
      getAppEnv={(key) => getAudioQnAAppEnv(key as AppEnvKey)}
      getFilePresignedUrl={getFilePresignedUrl}
      downloadFile={downloadFile}
      deleteFile={deleteFile}
    />
  );
};

export default DataIngestionFilesRoute;
