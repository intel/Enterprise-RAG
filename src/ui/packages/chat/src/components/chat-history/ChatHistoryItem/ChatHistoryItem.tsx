// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Button, Tooltip } from "@intel-enterprise-rag-ui/components";
import { PinFilledIcon } from "@intel-enterprise-rag-ui/icons";
import { HistoryItem } from "@intel-enterprise-rag-ui/layouts";

import type { OnPinChangeHandler } from "@/components/chat-history/ChatHistoryItemMenu/ChatHistoryItemMenu";
import { ChatHistoryItemMenu } from "@/components/chat-history/ChatHistoryItemMenu/ChatHistoryItemMenu";
import type { OnDeleteChatHandler } from "@/components/chat-history/DeleteChatDialog/DeleteChatDialog";
import type { OnExportChatHandler } from "@/components/chat-history/ExportChatDialog/ExportChatDialog";
import type { OnRenameChatHandler } from "@/components/chat-history/RenameChatDialog/RenameChatDialog";
import { ChatHistoryItemData } from "@/types";

const TITLE_OVERFLOW_LIMIT = 12;
const PINNED_TITLE_OVERFLOW_LIMIT = 10;
const CHAT_NAME_CHAR_LIMIT = 250;

export type OnChatHistoryItemPressHandler = (id: string) => void;

interface ChatHistoryItemProps {
  itemData: ChatHistoryItemData;
  pinned: boolean;
  onPinChange: OnPinChangeHandler;
  isActive: boolean;
  onPress: OnChatHistoryItemPressHandler;
  onDelete: OnDeleteChatHandler;
  onExport: OnExportChatHandler;
  onRename: OnRenameChatHandler;
}

export const ChatHistoryItem = ({
  itemData,
  pinned,
  onPinChange,
  isActive,
  onPress,
  onDelete,
  onExport,
  onRename,
}: ChatHistoryItemProps) => {
  const pinButton = pinned && (
    <Tooltip
      title="Unpin"
      trigger={
        <Button
          data-testid="unpin-chat-button"
          aria-label="Unpin chat"
          className="text-foreground hover:text-foreground flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 transition-colors hover:bg-transparent"
          onPress={onPinChange}
        >
          <PinFilledIcon />
        </Button>
      }
    />
  );

  return (
    <HistoryItem
      data-testid="chat-history-item"
      title={itemData.name}
      isActive={isActive}
      onPress={() => onPress(itemData.id)}
      leading={pinButton}
      titleOverflowLimit={
        pinned ? PINNED_TITLE_OVERFLOW_LIMIT : TITLE_OVERFLOW_LIMIT
      }
      onRename={(newName) => onRename(itemData.id, newName)}
      renameMaxLength={CHAT_NAME_CHAR_LIMIT}
      renameAriaLabel="Rename chat"
      renderMenu={({ isOpen, onOpenChange }) => (
        <ChatHistoryItemMenu
          itemData={itemData}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          pinned={pinned}
          onPinChange={onPinChange}
          onDelete={onDelete}
          onExport={onExport}
          onRename={onRename}
        />
      )}
    />
  );
};
