// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./UploadDataDialogFooter.css";

import { Button } from "@intel-enterprise-rag-ui/components";
import { IconName } from "@intel-enterprise-rag-ui/icons";

import UploadErrorsPopover from "@/components/UploadErrorsPopover/UploadErrorsPopover";
import { UploadErrors } from "@/types";

interface UploadDataDialogFooterProps {
  uploadErrors: UploadErrors;
  toBeUploadedMessage: string;
  isUploadDisabled: boolean;
  isUploading: boolean;
  onSubmit: () => void;
  getAppEnv: (key: string) => string | undefined;
}

const UploadDataDialogFooter = ({
  uploadErrors,
  toBeUploadedMessage,
  isUploadDisabled,
  isUploading,
  onSubmit,
  getAppEnv,
}: UploadDataDialogFooterProps) => {
  const hasUploadErrors =
    uploadErrors.files !== "" || uploadErrors.links !== "";

  const uploadBtnContent = isUploading ? "Uploading..." : "Upload Data";
  const uploadBtnIcon: IconName | undefined = isUploading
    ? "loading"
    : undefined;

  return (
    <div className="upload-dialog__footer">
      {hasUploadErrors ? (
        <UploadErrorsPopover
          uploadErrors={uploadErrors}
          getAppEnv={getAppEnv}
        />
      ) : (
        toBeUploadedMessage
      )}
      <Button
        data-testid="upload-data-button"
        icon={uploadBtnIcon}
        isDisabled={isUploadDisabled}
        onPress={onSubmit}
      >
        {uploadBtnContent}
      </Button>
    </div>
  );
};

export default UploadDataDialogFooter;
