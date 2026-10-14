// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { keycloakService } from "@intel-enterprise-rag-ui/auth";
import {
  ViewSwitchButton as SharedViewSwitchButton,
  ViewSwitchOption,
} from "@intel-enterprise-rag-ui/components";
import { useLocation, useNavigate } from "react-router-dom";

import { paths } from "@/config/paths";

type ViewKey = "docsum" | "admin-panel";

const options: Record<ViewKey, ViewSwitchOption> = {
  docsum: {
    id: "docsum",
    label: "DocSum",
    icon: "plain-text",
    ariaLabel: "Switch to Document Summarization",
    "data-testid": "view-switch-btn--to-docsum",
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

  if (!keycloakService.isAdminUser() && !keycloakService.isMaintainerUser()) {
    return null;
  }

  const isDocSumPage = location.pathname.startsWith(paths.docsum);
  const isAdminPanelPage = location.pathname.startsWith(paths.adminPanel);

  if (!isDocSumPage && !isAdminPanelPage) {
    return null;
  }

  const currentView: ViewKey = isDocSumPage ? "docsum" : "admin-panel";

  const navigateToView = (view: ViewKey) => {
    navigate(view === "docsum" ? paths.docsum : paths.adminPanel);
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
