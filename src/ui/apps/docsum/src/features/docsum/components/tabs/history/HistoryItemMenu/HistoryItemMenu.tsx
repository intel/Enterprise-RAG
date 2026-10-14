// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  Tooltip,
} from "@intel-enterprise-rag-ui/components";
import {
  DeleteIcon,
  EditIcon,
  ExportIcon,
} from "@intel-enterprise-rag-ui/icons";
import { useState } from "react";

import ExportActionDialog from "@/features/docsum/components/shared/ExportActionDialog/ExportActionDialog";
import DeleteActionDialog from "@/features/docsum/components/tabs/history/DeleteActionDialog/DeleteActionDialog";
import RenameActionDialog from "@/features/docsum/components/tabs/history/RenameActionDialog/RenameActionDialog";
import { HistoryItemData } from "@/features/docsum/types/history";

export type HistoryItemAction = "rename" | "export" | "delete";

interface HistoryItemMenuProps {
  itemData: HistoryItemData;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const HistoryItemMenu = ({
  itemData,
  isOpen,
  onOpenChange,
}: HistoryItemMenuProps) => {
  const [selectedOption, setSelectedOption] =
    useState<HistoryItemAction | null>(null);

  const handleMenuAction = (key: string) => {
    setSelectedOption(key as HistoryItemAction);
  };

  return (
    <>
      <DropdownMenuTrigger
        trigger={
          <Tooltip
            title="More"
            trigger={
              <IconButton
                data-testid="history-item-menu-button"
                icon="more-options"
                size="sm"
                aria-label="Manage Summary"
                className="hover:bg-background rounded-full"
              />
            }
          />
        }
        isOpen={isOpen}
        ariaLabel="Summary History Item Menu"
        onOpenChange={onOpenChange}
      >
        <DropdownMenu
          data-testid="history-item-menu"
          onAction={handleMenuAction}
        >
          <DropdownMenuItem data-testid="rename-summary-menu-item" id="rename">
            <EditIcon />
            <span>Rename</span>
          </DropdownMenuItem>
          <DropdownMenuItem data-testid="export-summary-menu-item" id="export">
            <ExportIcon />
            <span>Export</span>
          </DropdownMenuItem>
          <DropdownMenuItem data-testid="delete-summary-menu-item" id="delete">
            <DeleteIcon />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenu>
      </DropdownMenuTrigger>
      <RenameActionDialog
        itemData={itemData}
        isOpen={selectedOption === "rename"}
        onOpenChange={() => setSelectedOption(null)}
      />
      {itemData.summary && (
        <ExportActionDialog
          summary={itemData.summary}
          fileName={itemData.title}
          isOpen={selectedOption === "export"}
          onOpenChange={() => setSelectedOption(null)}
        />
      )}
      <DeleteActionDialog
        itemData={itemData}
        isOpen={selectedOption === "delete"}
        onOpenChange={() => setSelectedOption(null)}
      />
    </>
  );
};

export default HistoryItemMenu;
