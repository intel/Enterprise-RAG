// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  ChatSidebar,
  selectIsChatSidebarOpen,
  useChatHistoryHandlers,
} from "@intel-enterprise-rag-ui/chat";
import {
  getActiveNavItem,
  PageLayout,
  Sidebar,
  SidebarNav,
} from "@intel-enterprise-rag-ui/layouts";
import { downloadBlob } from "@intel-enterprise-rag-ui/utils";
import { useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import {
  SidePanelFooterContent,
  SidePanelHeaderContent,
} from "@/components/AppHeaderContent/AppHeaderContent";
import { useAppHeaderProps } from "@/components/AppHeaderContent/useAppHeaderProps";
import ViewSwitchButton from "@/components/ViewSwitchButton/ViewSwitchButton";
import { paths } from "@/config/paths";
import {
  useChangeChatNameMutation,
  useDeleteChatMutation,
  useGetAllChatsQuery,
  useLazyGetAllChatsQuery,
  useLazyGetChatByIdQuery,
} from "@/features/chat/api/chatHistory.api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { getAudioQnAAppEnv } from "@/utils";

const MAINTENANCE_MODE = getAudioQnAAppEnv("MAINTENANCE_MODE") === "true";

const ADMIN_PANEL_NAV_ITEMS = [
  {
    name: "Control Plane",
    path: "control-plane",
    icon: "control-plane" as const,
    id: "control-plane",
  },
  {
    name: "Data Ingestion",
    icon: "data-prep" as const,
    id: "data-ingestion",
    children: [
      {
        name: "Ingested Files",
        path: "data-ingestion/files",
        icon: "file" as const,
        id: "data-ingestion-files",
      },
      {
        name: "Ingested Links",
        path: "data-ingestion/links",
        icon: "link" as const,
        id: "data-ingestion-links",
      },
      {
        name: "Upload Data",
        path: "data-ingestion/upload",
        icon: "upload" as const,
        id: "data-ingestion-upload",
      },
      {
        name: "Bucket Synchronization",
        path: "data-ingestion/bucket-sync",
        icon: "bucket-synchronization" as const,
        id: "data-ingestion-bucket-sync",
      },
    ],
  },
  {
    name: "Settings",
    path: "settings",
    icon: "settings" as const,
    id: "settings",
  },
  {
    name: "Grafana Dashboard",
    href: getAudioQnAAppEnv("GRAFANA_DASHBOARD_URL"),
    icon: "telemetry" as const,
    id: "grafana-dashboard",
  },
  {
    name: "Keycloak Admin Panel",
    href: getAudioQnAAppEnv("KEYCLOAK_ADMIN_PANEL_URL"),
    icon: "identity-provider" as const,
    id: "keycloak-admin-panel",
  },
];

export interface AppShellOutletContext {
  /** Lets a chat-conversation leaf route register its onNewChat handler in the shell's footer */
  setOnNewChat: (onNewChat: (() => void) | undefined) => void;
}

/**
 * Owns the app header + sidebar shell above the router's leaf routes, so neither remounts on
 * navigation — only the sidebar's content (chat history vs. admin-panel nav) and the main
 * outlet content change.
 */
const AppShellLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { chatId } = useParams<{ chatId?: string }>();

  const isAdminSection = location.pathname.startsWith(paths.adminPanel);
  const appHeaderProps = useAppHeaderProps();

  const isChatSidebarOpen = useAppSelector(selectIsChatSidebarOpen);

  const [onNewChat, setOnNewChatState] = useState<(() => void) | undefined>(
    undefined,
  );
  const outletContext: AppShellOutletContext = {
    setOnNewChat: setOnNewChatState,
  };
  // The sidebar's New Chat button is always visible, so it always needs a working handler — fall
  // back to navigating to the blank chat route when no leaf route has registered its own (live)
  // handler yet (e.g. already on that blank route).
  const handleNewChat = onNewChat ?? (() => navigate(paths.chat));

  const { data: chatHistoryData, isLoading: isLoadingChatHistory } =
    useGetAllChatsQuery(undefined, {
      skip: isAdminSection || MAINTENANCE_MODE,
    });

  const chatName = chatHistoryData?.find((chat) => chat.id === chatId)?.name;
  const activeAdminNavItem = isAdminSection
    ? getActiveNavItem(
        ADMIN_PANEL_NAV_ITEMS,
        paths.adminPanel,
        location.pathname,
      )
    : undefined;
  const title = isAdminSection ? activeAdminNavItem?.name : chatName;
  const titleIcon = activeAdminNavItem?.icon;
  const isChatTitleEditable = !isAdminSection && Boolean(chatId);

  const {
    handleItemPress,
    isItemActive,
    handleDelete,
    handleExport,
    handleRename,
  } = useChatHistoryHandlers({
    chatHistoryData,
    useDeleteChatMutation,
    useLazyGetAllChatsQuery,
    useLazyGetChatByIdQuery,
    useChangeChatNameMutation,
    dispatch,
    location,
    navigate,
    chatBasePath: paths.chat,
    onDeleteError: (error) => {
      toast.error(`Failed to delete chat history: ${error.message}`);
    },
    onRenameError: (error) => {
      toast.error(`Failed to rename chat: ${error.message}`);
    },
    onExportSuccess: (blob, fileName) => {
      downloadBlob(blob, fileName);
    },
  });

  let sidebarContent;
  if (isAdminSection) {
    sidebarContent = (
      <Sidebar
        direction="left"
        isOpen={isChatSidebarOpen}
        ariaLabel="Admin Panel Sidebar"
        headerContent={<SidePanelHeaderContent />}
        viewSwitchButton={<ViewSwitchButton />}
        footerContent={<SidePanelFooterContent />}
        hasHeader
      >
        <SidebarNav
          basePath={paths.adminPanel}
          items={ADMIN_PANEL_NAV_ITEMS}
          aria-label="Admin Panel Navigation"
          data-testid="admin-panel-tabs"
        />
      </Sidebar>
    );
  } else if (MAINTENANCE_MODE) {
    sidebarContent = (
      <Sidebar
        direction="left"
        isOpen={isChatSidebarOpen}
        ariaLabel="Chat Sidebar"
        headerContent={<SidePanelHeaderContent />}
        viewSwitchButton={<ViewSwitchButton />}
        footerContent={<SidePanelFooterContent />}
        hasHeader
      />
    );
  } else {
    sidebarContent = (
      <ChatSidebar
        isOpen={isChatSidebarOpen}
        chatHistoryData={chatHistoryData}
        isLoadingChatHistory={isLoadingChatHistory}
        onItemPress={handleItemPress}
        isItemActive={isItemActive}
        onDelete={handleDelete}
        onExport={handleExport}
        onRename={handleRename}
        headerContent={<SidePanelHeaderContent />}
        footerContent={<SidePanelFooterContent />}
        viewSwitchButton={<ViewSwitchButton />}
        onNewChat={handleNewChat}
      />
    );
  }

  return (
    <PageLayout
      appHeaderProps={{
        ...appHeaderProps,
        title,
        titleIcon,
        onTitleRename:
          isChatTitleEditable && chatId
            ? (newTitle) => handleRename(chatId, newTitle)
            : undefined,
      }}
      leftSidebar={{ component: sidebarContent, isOpen: isChatSidebarOpen }}
    >
      <Outlet context={outletContext} />
    </PageLayout>
  );
};

export default AppShellLayout;
