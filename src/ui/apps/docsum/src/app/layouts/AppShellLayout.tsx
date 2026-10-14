// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  getActiveNavItem,
  PageLayout,
  Sidebar,
  SidebarNav,
} from "@intel-enterprise-rag-ui/layouts";
import { Outlet, useLocation } from "react-router-dom";

import {
  SidePanelFooterContent,
  SidePanelHeaderContent,
} from "@/components/AppHeaderContent/AppHeaderContent";
import { useAppHeaderProps } from "@/components/AppHeaderContent/useAppHeaderProps";
import ViewSwitchButton from "@/components/ViewSwitchButton/ViewSwitchButton";
import { paths } from "@/config/paths";
import { getDocSumAppEnv } from "@/utils";

const ADMIN_PANEL_NAV_ITEMS = [
  {
    name: "Control Plane",
    path: "control-plane",
    icon: "control-plane" as const,
    id: "control-plane",
  },
  {
    name: "Settings",
    path: "settings",
    icon: "settings" as const,
    id: "settings",
  },
  {
    name: "Grafana Dashboard",
    href: getDocSumAppEnv("GRAFANA_DASHBOARD_URL"),
    icon: "telemetry" as const,
    id: "grafana-dashboard",
  },
  {
    name: "Keycloak Admin Panel",
    href: getDocSumAppEnv("KEYCLOAK_ADMIN_PANEL_URL"),
    icon: "identity-provider" as const,
    id: "keycloak-admin-panel",
  },
];

const DOCSUM_NAV_ITEMS = [
  {
    name: "Paste Text",
    path: "paste-text",
    icon: "plain-text" as const,
    id: "paste-text",
  },
  {
    name: "Upload File",
    path: "upload-file",
    icon: "upload" as const,
    id: "upload-file",
  },
  { name: "History", path: "history", icon: "history" as const, id: "history" },
];

/**
 * Owns the app header + sidebar shell above the router's leaf routes, so neither remounts on
 * navigation — only the sidebar's nav content (docsum vs. admin-panel) and the main outlet
 * content change.
 */
const AppShellLayout = () => {
  const location = useLocation();
  const isAdminSection = location.pathname.startsWith(paths.adminPanel);
  const appHeaderProps = useAppHeaderProps();
  const isSidebarOpen = appHeaderProps.isSidebarOpen ?? false;
  const activeAdminNavItem = isAdminSection
    ? getActiveNavItem(
        ADMIN_PANEL_NAV_ITEMS,
        paths.adminPanel,
        location.pathname,
      )
    : undefined;
  const title = activeAdminNavItem?.name;
  const titleIcon = activeAdminNavItem?.icon;

  const sidebarContent = isAdminSection ? (
    <Sidebar
      direction="left"
      isOpen={isSidebarOpen}
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
  ) : (
    <Sidebar
      direction="left"
      isOpen={isSidebarOpen}
      ariaLabel="Document Summarization Sidebar"
      headerContent={<SidePanelHeaderContent />}
      viewSwitchButton={<ViewSwitchButton />}
      footerContent={<SidePanelFooterContent />}
      hasHeader
    >
      <SidebarNav
        basePath={paths.docsum}
        items={DOCSUM_NAV_ITEMS}
        aria-label="Document Summarization Navigation"
        data-testid="docsum-tabs"
      />
    </Sidebar>
  );

  return (
    <PageLayout
      appHeaderProps={{ ...appHeaderProps, title, titleIcon }}
      leftSidebar={{ component: sidebarContent, isOpen: isSidebarOpen }}
    >
      <Outlet />
    </PageLayout>
  );
};

export default AppShellLayout;
