// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { HistoryItem as SharedHistoryItem } from "@intel-enterprise-rag-ui/layouts";

import HistoryItemMenu from "@/features/docsum/components/tabs/history/HistoryItemMenu/HistoryItemMenu";
import { renameHistoryItem } from "@/features/docsum/store/history.slice";
import { HistoryItemData } from "@/features/docsum/types/history";
import { getItemIconName } from "@/features/docsum/utils/render";
import { useAppDispatch } from "@/store/hooks";

const TITLE_OVERFLOW_LIMIT = 22;
const NAME_CHAR_LIMIT = 250;

interface HistoryItemProps {
  itemData: HistoryItemData;
  isActive: boolean;
  onItemSelect: (item: HistoryItemData) => void;
}

const HistoryItem = ({
  itemData,
  isActive,
  onItemSelect,
}: HistoryItemProps) => {
  const dispatch = useAppDispatch();

  return (
    <SharedHistoryItem
      data-testid="history-item"
      title={itemData.title}
      isActive={isActive}
      onPress={() => onItemSelect(itemData)}
      icon={getItemIconName(itemData)}
      titleOverflowLimit={TITLE_OVERFLOW_LIMIT}
      onRename={(newName) =>
        dispatch(renameHistoryItem({ id: itemData.id, newName }))
      }
      renameMaxLength={NAME_CHAR_LIMIT}
      renameAriaLabel="Rename summary"
      renderMenu={({ isOpen, onOpenChange }) => (
        <HistoryItemMenu
          itemData={itemData}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )}
    />
  );
};

export default HistoryItem;
