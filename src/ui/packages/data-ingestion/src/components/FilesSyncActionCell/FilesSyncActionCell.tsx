// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  DeleteIcon,
  PlusIcon,
  UploadIcon,
} from "@intel-enterprise-rag-ui/icons";
import { titleCaseString } from "@intel-enterprise-rag-ui/utils";
import classNames from "classnames";
import { ReactNode } from "react";

import { FileSyncAction } from "@/types/api";

const actionIconMap: Record<FileSyncAction, ReactNode> = {
  add: <PlusIcon />,
  "no action": null,
  delete: <DeleteIcon />,
  update: <UploadIcon />,
};

interface FilesSyncActionCellProps {
  action: FileSyncAction;
}

const FilesSyncActionCell = ({ action }: FilesSyncActionCellProps) => {
  const className = classNames("mr-2 flex items-center gap-1", {
    "text-success": action === "add",
    "text-destructive": action === "delete",
    "text-primary": action === "update",
  });

  const icon = actionIconMap[action];

  return (
    <div className={className}>
      {icon}
      <p>{titleCaseString(action)}</p>
    </div>
  );
};

export default FilesSyncActionCell;
