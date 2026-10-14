// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { titleCaseString } from "@intel-enterprise-rag-ui/utils";
import { ColumnDef } from "@tanstack/react-table";

import FilesSyncActionCell from "@/components/FilesSyncActionCell/FilesSyncActionCell";
import { FileSyncAction, FileSyncDataItem } from "@/types/api";

const ACTION_FILTER_OPTIONS: string[] = (
  ["add", "update", "delete", "no action"] as FileSyncAction[]
).map(titleCaseString);

export const filesSyncColumns: ColumnDef<FileSyncDataItem>[] = [
  {
    accessorKey: "action",
    header: "Action",
    accessorFn: (row) => titleCaseString(row.action),
    filterFn: "equalsString",
    meta: { filterOptions: ACTION_FILTER_OPTIONS },
    cell: ({
      row: {
        original: { action },
      },
    }) => <FilesSyncActionCell action={action} />,
  },
  {
    accessorKey: "bucket_name",
    header: "Bucket",
  },
  {
    accessorKey: "object_name",
    header: "Name",
    cell: ({
      row: {
        original: { object_name: fileName },
      },
    }) => <div className="text-wrap [overflow-wrap:anywhere]">{fileName}</div>,
  },
];
