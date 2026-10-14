// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  Dialog,
  DialogRef,
  IconButton,
  Tooltip,
} from "@intel-enterprise-rag-ui/components";
import { ExternalLinkIcon } from "@intel-enterprise-rag-ui/icons";
import { useRef } from "react";

const SUPPORT_URL = "https://supporttickets.intel.com/s/supportrequest";
const GITHUB_ISSUES_URL =
  "https://github.com/opea-project/Enterprise-RAG/issues";

interface AboutDialogProps {
  appName: string;
  appVersion: string;
  userGuideUrl?: string;
}

export const AboutDialog = ({
  appName,
  appVersion,
  userGuideUrl,
}: AboutDialogProps) => {
  const trigger = (
    <Tooltip
      title="About"
      trigger={
        <IconButton
          data-testid="about-dialog-trigger-button"
          icon="info-filled"
          aria-label="About"
        />
      }
      placement="bottom"
    />
  );

  const dialogRef = useRef<DialogRef>(null);

  const handleClose = () => {
    dialogRef.current?.close();
  };

  return (
    <Dialog
      ref={dialogRef}
      data-testid="about-dialog"
      trigger={trigger}
      title="About"
      maxWidth={600}
      onClose={handleClose}
      isCentered
    >
      <div className="flex flex-col text-sm leading-relaxed">
        <h2 className="text-foreground text-lg font-semibold">{appName}</h2>
        <p className="mb-4">
          <span className="font-medium">Version:</span> {appVersion}
        </p>
        {userGuideUrl && (
          <p className="mb-2">
            The{" "}
            <a
              href={userGuideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground inline-flex items-center underline"
            >
              User Guide
              <ExternalLinkIcon fontSize={10} />
            </a>{" "}
            provides detailed instructions and helpful tips for using all
            features of this application. Please refer to it for guidance and
            best practices.
          </p>
        )}
        <p className="mb-2">
          To request a feature, please open a new issue on our{" "}
          <a
            href={GITHUB_ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground inline-flex items-center underline"
          >
            GitHub Issues
            <ExternalLinkIcon fontSize={10} />
          </a>{" "}
          page.
        </p>
        <p className="mb-2">
          If you need support, please{" "}
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground mb-2 inline-flex items-center underline"
          >
            create a request
            <ExternalLinkIcon fontSize={10} />
          </a>
          . Select <b className="font-medium">Software</b> and{" "}
          <b className="font-medium">Intel&reg; AI for Enterprise</b>.
        </p>
      </div>
    </Dialog>
  );
};
