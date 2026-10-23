// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./dataTableCells.css";

import { ColumnDef } from "@tanstack/react-table";

import FilesSyncActionCell from "@/components/FilesSyncActionCell/FilesSyncActionCell";
import { FileSyncDataItem } from "@/types/api";

export const filesSyncColumns: ColumnDef<FileSyncDataItem>[] = [
  {
    accessorKey: "action",
    header: "Action",
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
    }) => <div className="data-table-cell__wrap">{fileName}</div>,
  },
];
