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
  PinFilledIcon,
  PinIcon,
} from "@intel-enterprise-rag-ui/icons";
import { useState } from "react";

import type { OnDeleteChatHandler } from "@/components/chat-history/DeleteChatDialog/DeleteChatDialog";
import { DeleteChatDialog } from "@/components/chat-history/DeleteChatDialog/DeleteChatDialog";
import type { OnExportChatHandler } from "@/components/chat-history/ExportChatDialog/ExportChatDialog";
import { ExportChatDialog } from "@/components/chat-history/ExportChatDialog/ExportChatDialog";
import type { OnRenameChatHandler } from "@/components/chat-history/RenameChatDialog/RenameChatDialog";
import { RenameChatDialog } from "@/components/chat-history/RenameChatDialog/RenameChatDialog";
import { ChatHistoryItemData } from "@/types";

export type ChatItemAction = "rename" | "export" | "pin" | "delete";
export type OnPinChangeHandler = () => void;

interface ChatHistoryItemMenuProps {
  itemData: ChatHistoryItemData;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  pinned: boolean;
  onPinChange: OnPinChangeHandler;
  onDelete: OnDeleteChatHandler;
  onExport: OnExportChatHandler;
  onRename: OnRenameChatHandler;
}

export const ChatHistoryItemMenu = ({
  itemData,
  isOpen,
  onOpenChange,
  pinned,
  onPinChange,
  onDelete,
  onExport,
  onRename,
}: ChatHistoryItemMenuProps) => {
  const [selectedOption, setSelectedOption] = useState<ChatItemAction | null>(
    null,
  );

  const handleMenuAction = (key: string) => {
    if (key === "pin") {
      onPinChange();
    } else {
      setSelectedOption(key as ChatItemAction);
    }
  };

  return (
    <>
      <DropdownMenuTrigger
        trigger={
          <Tooltip
            title="More"
            trigger={
              <IconButton
                data-testid="chat-history-item-menu-button"
                icon="more-options"
                size="sm"
                aria-label="Manage Chat"
                className="hover:bg-background rounded-full"
              />
            }
          />
        }
        isOpen={isOpen}
        ariaLabel="Chat History Item Menu"
        onOpenChange={onOpenChange}
      >
        <DropdownMenu
          data-testid="chat-history-item-menu"
          onAction={handleMenuAction}
        >
          <DropdownMenuItem data-testid="rename-chat-menu-item" id="rename">
            <EditIcon />
            <span>Rename</span>
          </DropdownMenuItem>
          <DropdownMenuItem data-testid="export-chat-menu-item" id="export">
            <ExportIcon />
            <span>Export</span>
          </DropdownMenuItem>
          <DropdownMenuItem data-testid="pin-chat-menu-item" id="pin">
            {pinned ? <PinFilledIcon /> : <PinIcon />}
            <span>{pinned ? "Unpin" : "Pin"}</span>
          </DropdownMenuItem>
          <DropdownMenuItem data-testid="delete-chat-menu-item" id="delete">
            <DeleteIcon />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenu>
      </DropdownMenuTrigger>
      <RenameChatDialog
        chatId={itemData.id}
        currentName={itemData.name}
        isOpen={selectedOption === "rename"}
        onOpenChange={() => setSelectedOption(null)}
        onRename={onRename}
      />
      <ExportChatDialog
        chatId={itemData.id}
        isOpen={selectedOption === "export"}
        onOpenChange={() => setSelectedOption(null)}
        onExport={onExport}
      />
      <DeleteChatDialog
        chatId={itemData.id}
        isOpen={selectedOption === "delete"}
        onOpenChange={() => setSelectedOption(null)}
        onDelete={onDelete}
      />
    </>
  );
};
