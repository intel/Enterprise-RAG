// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./index.css";

// Components
export { ChatSidebar } from "@/components/chat-history/ChatSidebar/ChatSidebar";
export { NewChatButton } from "@/components/chat-history/NewChatButton/NewChatButton";
export { ConversationFeed } from "@/components/conversation-feed/ConversationFeed/ConversationFeed";
export { type PlaySpeechButtonState } from "@/components/conversation-feed/PlaySpeechButton/PlaySpeechButton";
export { PromptInput } from "@/components/conversation-feed/PromptInput/PromptInput";
export { SidebarToggleButton as ChatSidebarToggleButton } from "@intel-enterprise-rag-ui/layouts";

// Layouts
export { ChatConversationLayout } from "@/layouts/ChatConversationLayout/ChatConversationLayout";
export { InitialChatLayout } from "@/layouts/InitialChatLayout/InitialChatLayout";

// Types
export type { ChatTurn } from "@/types";

// API Factories
export { createChatHistoryApi } from "@/api/chatHistory.api";
export { createQnAApi, type QnAApiConfig } from "@/api/qna.api";

// Store - Redux Slices
export {
  chatHistoryReducer,
  resetChatHistorySlice,
  selectChatById,
  setChatTurns,
} from "@/store/chatHistory.slice";
export {
  chatSidebarReducer,
  resetChatSidebarSlice,
  selectIsChatSidebarOpen,
  toggleChatSidebar,
} from "@/store/chatSidebar.slice";

// Hooks
export { useChat } from "@/hooks/useChat";
export { useChatHistoryHandlers } from "@/hooks/useChatHistoryHandlers";
export { useInitialChat } from "@/hooks/useInitialChat";
