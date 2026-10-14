// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  Anchor,
  Popover,
  usePopover,
} from "@intel-enterprise-rag-ui/components";
import { ErrorIcon } from "@intel-enterprise-rag-ui/icons";
import { titleCaseString } from "@intel-enterprise-rag-ui/utils";

import { UploadErrors } from "@/types";

interface UploadErrorsPopoverProps {
  uploadErrors: UploadErrors;
  getAppEnv: (key: string) => string | undefined;
}

const UploadErrorsPopover = ({
  uploadErrors,
  getAppEnv,
}: UploadErrorsPopoverProps) => {
  const s3Url = getAppEnv("S3_URL");
  const { triggerRef, isOpen, togglePopover } = usePopover<HTMLDivElement>();

  const UndeterminedNetworkErrorMessage = (
    <>
      <p className="mb-2">
        The upload failed for an undetermined network reason. This issue may
        occur due to certificate that the browser does not trust.
      </p>
      <p className="mb-2">
        If you are using self-signed or custom certificate, open the URL below
        and accept the certificate. After doing this, click outside this popover
        and retry upload.
      </p>
      <Anchor href={s3Url}>{s3Url}</Anchor>
    </>
  );

  const getUploadErrors = (dataType: "links" | "files") => {
    if (uploadErrors[dataType] === "") {
      return null;
    }

    const isUndeterminedNetworkError =
      uploadErrors[dataType].includes("Failed to upload");

    const sectionTitle = titleCaseString(dataType);

    return (
      <section className="bg-destructive/10 text-destructive max-w-80 rounded p-3 text-xs [overflow-wrap:anywhere] shadow-lg not-last:mb-4">
        <h4 className="mb-2 font-medium">{sectionTitle}</h4>
        <p className="mb-2">{uploadErrors[dataType]}</p>
        {isUndeterminedNetworkError && UndeterminedNetworkErrorMessage}
      </section>
    );
  };

  return (
    <>
      <div
        ref={triggerRef}
        className="flex items-center gap-2 text-sm"
        onClick={togglePopover}
      >
        <ErrorIcon className="text-destructive" />
        <p className="text-destructive cursor-pointer font-semibold underline">
          Error during upload
        </p>
      </div>
      <Popover
        data-testid="upload-errors-popover"
        isOpen={isOpen}
        triggerRef={triggerRef}
        placement="top end"
        ariaLabel="Upload Errors"
        onOpenChange={togglePopover}
      >
        {getUploadErrors("files")}
        {getUploadErrors("links")}
      </Popover>
    </>
  );
};

export default UploadErrorsPopover;
