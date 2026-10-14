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
import MaintenanceModeNotice from "@/components/MaintenanceModeNotice/MaintenanceModeNotice";
import { paths } from "@/config/paths";
import {
  useLazyGetChatByIdQuery,
  useSaveChatMutation,
} from "@/features/chat/api/chatHistory.api";
import { usePostPromptMutation } from "@/features/chat/api/chatQnA.api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { getChatQnAAppEnv } from "@/utils";

const MAINTENANCE_MODE = getChatQnAAppEnv("MAINTENANCE_MODE") === "true";

const InitialChatRoute = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const isChatSidebarOpen = useAppSelector(selectIsChatSidebarOpen);
  const [downloadFile] = useLazyDownloadFileQuery();
  const [getFilePresignedUrl] = useGetFilePresignedUrlMutation();
  const [postSharePointFileUrl] = usePostSharePointFileUrlMutation();

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

  const chatDisclaimer = getChatQnAAppEnv("CHAT_DISCLAIMER_TEXT") ?? "";

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

  if (MAINTENANCE_MODE) {
    return <MaintenanceModeNotice />;
  }

  if (chatTurns.length === 0) {
    return (
      <InitialChatLayout
        userInput={userInput}
        disclaimer={chatDisclaimer}
        onPromptChange={onPromptChange}
        onPromptSubmit={onPromptSubmit}
      />
    );
  }

  return (
    <ChatConversationLayout
      userInput={userInput}
      conversationTurns={chatTurns}
      isChatResponsePending={isChatResponsePending}
      disclaimer={chatDisclaimer}
      onPromptChange={onPromptChange}
      onPromptSubmit={onPromptSubmit}
      onRequestAbort={onRequestAbort}
      onFileDownload={handleFileDownload}
    />
  );
};

export default InitialChatRoute;
