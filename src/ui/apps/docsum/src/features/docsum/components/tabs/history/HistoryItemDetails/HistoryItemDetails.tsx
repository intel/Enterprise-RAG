// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from "react";

import GeneratedSummary from "@/features/docsum/components/shared/GeneratedSummary/GeneratedSummary";
import { HistoryItemData } from "@/features/docsum/types/history";
import { getItemIcon } from "@/features/docsum/utils/render";

interface HistoryItemDetailsProps {
  itemData: HistoryItemData;
}

const HistoryItemDetails = ({ itemData }: HistoryItemDetailsProps) => {
  const icon = useMemo(() => getItemIcon(itemData), [itemData]);

  return (
    <div className="h-full">
      <header className="mt-2 mb-4 flex h-6 items-center gap-3 [&_svg]:h-full [&_svg]:w-6 [&_svg]:text-2xl">
        {icon}
        <h2 className="m-0 text-lg font-medium">{itemData.title}</h2>
        <p className="m-0 ml-auto self-start text-xs">
          {new Date(itemData.timestamp).toLocaleString()}
        </p>
      </header>
      <div className="h-[calc(100%-3rem)] min-h-0 overflow-y-auto">
        <GeneratedSummary
          summary={itemData.summary}
          fileName={
            itemData.sourceType === "file" ? itemData.source : itemData.title
          }
        />
      </div>
    </div>
  );
};

export default HistoryItemDetails;
