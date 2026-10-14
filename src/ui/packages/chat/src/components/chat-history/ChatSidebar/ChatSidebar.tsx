// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Sidebar } from "@intel-enterprise-rag-ui/layouts";
import { ReactNode } from "react";

import type { OnChatHistoryItemPressHandler } from "@/components/chat-history/ChatHistoryItem/ChatHistoryItem";
import type { IsItemActiveHandler } from "@/components/chat-history/ChatHistoryList/ChatHistoryList";
import { ChatHistoryList } from "@/components/chat-history/ChatHistoryList/ChatHistoryList";
import type { OnDeleteChatHandler } from "@/components/chat-history/DeleteChatDialog/DeleteChatDialog";
import type { OnExportChatHandler } from "@/components/chat-history/ExportChatDialog/ExportChatDialog";
import { NewChatButton } from "@/components/chat-history/NewChatButton/NewChatButton";
import type { OnRenameChatHandler } from "@/components/chat-history/RenameChatDialog/RenameChatDialog";
import { ChatHistoryItemData } from "@/types";

interface ChatSidebarProps {
  isOpen: boolean;
  chatHistoryData?: ChatHistoryItemData[];
  isLoadingChatHistory: boolean;
  onItemPress: OnChatHistoryItemPressHandler;
  isItemActive: IsItemActiveHandler;
  onDelete: OnDeleteChatHandler;
  onExport: OnExportChatHandler;
  onRename: OnRenameChatHandler;
  footerContent?: ReactNode;
  /** Rendered as the side panel's own top header row, matching the app header's height */
  headerContent?: ReactNode;
  /** Rendered as the first element in the side panel, above the chat history list */
  viewSwitchButton?: ReactNode;
  /** New Chat always renders above the chat history search bar — the shell must always supply a
   * working handler (e.g. falling back to navigating to the blank chat route), not omit it. */
  onNewChat: () => void;
}

export const ChatSidebar = ({
  isOpen,
  chatHistoryData,
  isLoadingChatHistory,
  onItemPress,
  isItemActive,
  onDelete,
  onExport,
  onRename,
  footerContent,
  headerContent,
  viewSwitchButton,
  onNewChat,
}: ChatSidebarProps) => (
  <Sidebar
    direction="left"
    isOpen={isOpen}
    ariaLabel="Chat Sidebar"
    hasHeader={!!headerContent}
    headerContent={headerContent}
    footerContent={footerContent}
    viewSwitchButton={viewSwitchButton}
  >
    <div className="mb-3">
      <NewChatButton onPress={onNewChat} />
    </div>
    <ChatHistoryList
      data={chatHistoryData}
      isLoading={isLoadingChatHistory}
      onItemPress={onItemPress}
      isItemActive={isItemActive}
      onDelete={onDelete}
      onExport={onExport}
      onRename={onRename}
    />
  </Sidebar>
);
