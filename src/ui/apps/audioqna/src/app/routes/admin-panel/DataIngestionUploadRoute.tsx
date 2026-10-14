// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { UploadDataView } from "@intel-enterprise-rag-ui/data-ingestion";

import { useGetFilePresignedUrlMutation } from "@/api";
import { usePostFileMutation } from "@/features/admin-panel/data-ingestion/api/s3Api";
import { AppEnvKey } from "@/types";
import { getAudioQnAAppEnv } from "@/utils";

const DataIngestionUploadRoute = () => {
  const [getFilePresignedUrl] = useGetFilePresignedUrlMutation();
  const [postFile] = usePostFileMutation();

  return (
    <UploadDataView
      getAppEnv={(key) => getAudioQnAAppEnv(key as AppEnvKey)}
      getFilePresignedUrl={getFilePresignedUrl}
      postFile={postFile}
    />
  );
};

export default DataIngestionUploadRoute;
