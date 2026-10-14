// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { useState } from "react";

import HistoryItem from "@/features/docsum/components/tabs/history/HistoryItem/HistoryItem";
import HistoryItemDetails from "@/features/docsum/components/tabs/history/HistoryItemDetails/HistoryItemDetails";
import { selectHistoryItems } from "@/features/docsum/store/history.slice";
import { HistoryItemData } from "@/features/docsum/types/history";
import { useAppSelector } from "@/store/hooks";

const HistoryTab = () => {
  const [selectedItemData, setSelectedItemData] =
    useState<HistoryItemData | null>(null);

  const items = useAppSelector(selectHistoryItems);

  const handleItemSelect = (item: HistoryItemData) => {
    setSelectedItemData(item);
  };

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-[21.25rem_1fr]">
      <div className="bg-secondary flex h-full flex-col pt-8 pr-8 pb-16 pl-16 [--history-item-bg:var(--secondary)]">
        <p className="mb-4 text-base font-medium">Summary History</p>
        <div className="flex h-full min-h-0 flex-1 [scrollbar-gutter:stable] flex-col gap-1 overflow-y-auto">
          {items.length === 0 && (
            <p className="flex h-40 items-center justify-center text-center text-xs">
              No history items available
            </p>
          )}
          {items.length > 0 &&
            items.map((item) => (
              <HistoryItem
                key={item.id}
                itemData={item}
                isActive={selectedItemData?.id === item.id}
                onItemSelect={handleItemSelect}
              />
            ))}
        </div>
      </div>
      <div className="h-full min-h-0 pt-6 pr-16 pb-16 pl-8">
        {selectedItemData === null && (
          <p className="text-foreground flex h-full items-center justify-center rounded text-center text-sm">
            Select item from the list to view summary details
          </p>
        )}
        {selectedItemData !== null && (
          <HistoryItemDetails itemData={selectedItemData} />
        )}
      </div>
    </div>
  );
};

export default HistoryTab;
