// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  ChatConversationLayout,
  selectIsChatSidebarOpen,
  useChat,
} from "@intel-enterprise-rag-ui/chat";
import { usePostSharePointFileUrlMutation } from "@intel-enterprise-rag-ui/data-ingestion";
import { useEffect } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";

import {
  useGetFilePresignedUrlMutation,
  useLazyDownloadFileQuery,
} from "@/api";
import type { AppShellOutletContext } from "@/app/layouts/AppShellLayout";
import { paths } from "@/config/paths";
import { usePostPromptMutation } from "@/features/chat/api/audioQnA.api";
import {
  useGetAllChatsQuery,
  useLazyGetChatByIdQuery,
  useSaveChatMutation,
} from "@/features/chat/api/chatHistory.api";
import { useTextToSpeech } from "@/features/chat/hooks/useTextToSpeech";
import { useSpeechToTextHandlers } from "@/hooks/useSpeechToTextHandlers";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setLastSelectedChatId } from "@/store/viewNavigation.slice";
import { getAudioQnAAppEnv } from "@/utils";

const ChatConversationRoute = () => {
  const navigate = useNavigate();
  const { chatId: chatIdFromParams } = useParams<{ chatId?: string }>();
  const dispatch = useAppDispatch();
  const isChatSidebarOpen = useAppSelector(selectIsChatSidebarOpen);
  const { setOnNewChat } = useOutletContext<AppShellOutletContext>();
  const [downloadFile] = useLazyDownloadFileQuery();
  const [getFilePresignedUrl] = useGetFilePresignedUrlMutation();
  const [postSharePointFileUrl] = usePostSharePointFileUrlMutation();

  const { handleSpeechToText, handleSpeechToTextError } =
    useSpeechToTextHandlers();

  const {
    userInput,
    chatTurns,
    isChatResponsePending,
    onNewChat,
    onPromptChange,
    onPromptSubmit,
    onRequestAbort,
  } = useChat({
    usePostPromptMutation,
    useGetAllChatsQuery,
    useLazyGetChatByIdQuery,
    streamingConfig: {
      dispatch,
      useSaveChatMutation,
      useLazyGetChatByIdQuery,
    },
    useAppSelector,
    currentChatId: chatIdFromParams,
    isChatSidebarOpen,
    onNavigate: (path) => navigate(path),
    onNavigateToChat: (chatId) => navigate(`${paths.chat}/${chatId}`),
    onChatIdChange: (chatId) => dispatch(setLastSelectedChatId(chatId)),
  });

  useEffect(() => {
    setOnNewChat(() => onNewChat);
    return () => setOnNewChat(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setOnNewChat]);

  const { playingTurnId, playingState, onPlayMessage } = useTextToSpeech();

  const chatDisclaimer = getAudioQnAAppEnv("CHAT_DISCLAIMER_TEXT") ?? "";

  const handleFileDownload = async (
    fileName: string,
    bucketName: string | null,
    siteName: string | null,
  ) => {
    if (siteName) {
      const { data } = await postSharePointFileUrl({
        site_name: siteName,
        object_name: fileName,
      });
      if (data?.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
      return;
    }

    if (!bucketName) return;

    const { data: presignedUrl } = await getFilePresignedUrl({
      fileName,
      method: "GET",
      bucketName,
    });

    if (presignedUrl) {
      downloadFile({ presignedUrl, fileName });
    }
  };

  return (
    <ChatConversationLayout
      userInput={userInput}
      conversationTurns={chatTurns}
      isChatResponsePending={isChatResponsePending}
      disclaimer={chatDisclaimer}
      playingTurnId={playingTurnId}
      playingState={playingState}
      onPromptChange={onPromptChange}
      onPromptSubmit={onPromptSubmit}
      onRequestAbort={onRequestAbort}
      onFileDownload={handleFileDownload}
      onPlayMessage={onPlayMessage}
      onSpeechToText={handleSpeechToText}
      onSpeechToTextError={handleSpeechToTextError}
      enableMicrophone
    />
  );
};

export default ChatConversationRoute;
