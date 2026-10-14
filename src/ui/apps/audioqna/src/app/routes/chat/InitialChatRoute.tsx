// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  ChatConversationLayout,
  InitialChatLayout,
  selectIsChatSidebarOpen,
  useInitialChat,
} from "@intel-enterprise-rag-ui/chat";
import { usePostSharePointFileUrlMutation } from "@intel-enterprise-rag-ui/data-ingestion";
import { useNavigate } from "react-router-dom";

import {
  useGetFilePresignedUrlMutation,
  useLazyDownloadFileQuery,
} from "@/api";
import { paths } from "@/config/paths";
import { usePostPromptMutation } from "@/features/chat/api/audioQnA.api";
import {
  useLazyGetChatByIdQuery,
  useSaveChatMutation,
} from "@/features/chat/api/chatHistory.api";
import { useTextToSpeech } from "@/features/chat/hooks/useTextToSpeech";
import { useSpeechToTextHandlers } from "@/hooks/useSpeechToTextHandlers";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { getAudioQnAAppEnv } from "@/utils";

const InitialChatRoute = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const isChatSidebarOpen = useAppSelector(selectIsChatSidebarOpen);
  const [downloadFile] = useLazyDownloadFileQuery();
  const [getFilePresignedUrl] = useGetFilePresignedUrlMutation();
  const [postSharePointFileUrl] = usePostSharePointFileUrlMutation();

  const { handleSpeechToText, handleSpeechToTextError } =
    useSpeechToTextHandlers();

  const {
    userInput,
    chatTurns,
    isChatResponsePending,
    onPromptChange,
    onPromptSubmit,
    onRequestAbort,
  } = useInitialChat({
    usePostPromptMutation,
    streamingConfig: {
      dispatch,
      useSaveChatMutation,
      useLazyGetChatByIdQuery,
    },
    isChatSidebarOpen,
    onNavigateToChat: (chatId) => navigate(`${paths.chat}/${chatId}`),
  });

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

  if (chatTurns.length === 0) {
    return (
      <InitialChatLayout
        userInput={userInput}
        disclaimer={chatDisclaimer}
        onPromptChange={onPromptChange}
        onPromptSubmit={onPromptSubmit}
        onSpeechToText={handleSpeechToText}
        onSpeechToTextError={handleSpeechToTextError}
        enableMicrophone
      />
    );
  }

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

export default InitialChatRoute;
