// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { keycloakService } from "@intel-enterprise-rag-ui/auth";
import {
  ViewSwitchButton as SharedViewSwitchButton,
  ViewSwitchOption,
} from "@intel-enterprise-rag-ui/components";
import { useLocation, useNavigate } from "react-router-dom";

import { paths } from "@/config/paths";
import { useAppSelector } from "@/store/hooks";
import {
  selectLastSelectedAdminTab,
  selectLastSelectedChatId,
} from "@/store/viewNavigation.slice";

type ViewKey = "chat" | "admin-panel";

const options: Record<ViewKey, ViewSwitchOption> = {
  chat: {
    id: "chat",
    label: "Chat",
    icon: "chat",
    ariaLabel: "Switch to Chat",
    "data-testid": "view-switch-btn--to-chat",
  },
  "admin-panel": {
    id: "admin-panel",
    label: "Admin Panel",
    icon: "admin-panel",
    ariaLabel: "Switch to Admin Panel",
    "data-testid": "view-switch-btn--to-admin-panel",
  },
};

const ViewSwitchButton = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const lastSelectedChatId = useAppSelector(selectLastSelectedChatId);
  const lastSelectedAdminTab = useAppSelector(selectLastSelectedAdminTab);

  if (!keycloakService.isAdminUser() && !keycloakService.isMaintainerUser()) {
    return null;
  }

  const isChatPage = location.pathname.startsWith(paths.chat);
  const isAdminPanelPage = location.pathname.startsWith(paths.adminPanel);

  if (!isChatPage && !isAdminPanelPage) {
    return null;
  }

  const currentView: ViewKey = isChatPage ? "chat" : "admin-panel";

  const navigateToView = (view: ViewKey) => {
    if (view === "chat") {
      const chatRoute = lastSelectedChatId
        ? `${paths.chat}/${lastSelectedChatId}`
        : paths.chat;
      navigate(chatRoute, { replace: true });
    } else {
      const adminRoute = `${paths.adminPanel}/${lastSelectedAdminTab}`;
      navigate(adminRoute, { replace: true });
    }
  };

  return (
    <SharedViewSwitchButton
      options={Object.values(options)}
      selected={currentView}
      onSelectionChange={(id) => navigateToView(id as ViewKey)}
    />
  );
};

export default ViewSwitchButton;
