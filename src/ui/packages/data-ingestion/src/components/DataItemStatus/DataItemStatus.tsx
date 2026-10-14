// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Tooltip } from "@intel-enterprise-rag-ui/components";
import {
  BlockedIcon,
  CanceledIcon,
  DataPrepIcon,
  DeleteIcon,
  DPGuardIcon,
  EmbeddingIcon,
  ErrorIcon,
  LoadingIcon,
  SuccessIcon,
  UploadIcon,
} from "@intel-enterprise-rag-ui/icons";
import { cn, titleCaseString } from "@intel-enterprise-rag-ui/utils";
import { memo, ReactNode } from "react";

import { DataStatus } from "@/types";

const statusIconMap: Record<DataStatus, ReactNode> = {
  uploaded: <UploadIcon weight="fill" />,
  error: <ErrorIcon weight="fill" />,
  processing: <LoadingIcon weight="fill" />,
  text_extracting: <DataPrepIcon weight="fill" />,
  text_compression: <DataPrepIcon weight="fill" />,
  text_splitting: <DataPrepIcon weight="fill" />,
  dpguard: <DPGuardIcon weight="fill" />,
  late_chunking: <EmbeddingIcon weight="fill" />,
  embedding: <EmbeddingIcon weight="fill" />,
  ingested: <SuccessIcon weight="fill" />,
  deleting: <DeleteIcon weight="fill" />,
  canceled: <CanceledIcon weight="fill" />,
  blocked: <BlockedIcon weight="fill" />,
};

const statusColorClassNames: Partial<Record<DataStatus, string>> = {
  uploaded: "text-success",
  embedding: "text-foreground",
  text_extracting: "text-foreground",
  text_compression: "text-foreground",
  text_splitting: "text-foreground",
  late_chunking: "text-foreground",
  ingested: "text-foreground",
  deleting: "text-destructive",
  error: "text-destructive",
  processing: "text-muted-foreground",
};

const formatStatus = (status: DataStatus): string =>
  status
    .split("_")
    .map((part) => titleCaseString(part))
    .join(" ");

interface DataItemStatusProps {
  status: DataStatus;
  statusMessage: string;
}

const DataItemStatus = memo(
  ({ status, statusMessage }: DataItemStatusProps) => {
    const statusIcon = statusIconMap[status];
    const statusText = !status ? "Unknown" : formatStatus(status);
    const isStatusMessageEmpty = statusMessage === "";
    const statusClassNames = cn(
      "mr-2 inline-flex cursor-default flex-nowrap items-center gap-2",
      statusColorClassNames[status],
      !isStatusMessageEmpty && "cursor-help",
    );

    const itemStatusIndicator = (
      <div className={statusClassNames}>
        {statusIcon}
        <p className="text-xs">{statusText}</p>
      </div>
    );

    if (isStatusMessageEmpty) {
      return itemStatusIndicator;
    }

    const tooltipPosition = status === "error" ? "bottom right" : "right";

    return (
      <Tooltip
        title={statusMessage}
        trigger={itemStatusIndicator}
        placement={tooltipPosition}
      />
    );
  },
);

DataItemStatus.displayName = "DataItemStatus";

export default DataItemStatus;
