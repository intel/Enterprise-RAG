// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  selectIsChatSidebarOpen,
  toggleChatSidebar,
} from "@intel-enterprise-rag-ui/chat";
import { AppHeaderProps } from "@intel-enterprise-rag-ui/layouts";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { getAudioQnAAppEnv } from "@/utils";

const MAINTENANCE_MODE = getAudioQnAAppEnv("MAINTENANCE_MODE");

/** Side panel is now available on every route, not just chat — the toggle in the header-left is
 * unconditional, and the same `chatSidebar` open/closed state now covers the whole app. */
export const useSidebarState = () => {
  const isSidebarOpen = useAppSelector(selectIsChatSidebarOpen);
  const dispatch = useAppDispatch();
  return {
    isSidebarOpen,
    onToggleSidebar: () => dispatch(toggleChatSidebar()),
  };
};

export const useAppHeaderProps = (): AppHeaderProps => {
  const { isSidebarOpen, onToggleSidebar } = useSidebarState();

  return {
    maintenanceMode: MAINTENANCE_MODE === "true",
    isSidebarOpen,
    onToggleSidebar,
  };
};
