// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { AppHeaderProps } from "@intel-enterprise-rag-ui/layouts";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectIsSidebarOpen, toggleSidebar } from "@/store/sidebar.slice";

export const useSidebarState = () => {
  const isSidebarOpen = useAppSelector(selectIsSidebarOpen);
  const dispatch = useAppDispatch();
  return {
    isSidebarOpen,
    onToggleSidebar: () => dispatch(toggleSidebar()),
  };
};

export const useAppHeaderProps = (): AppHeaderProps => {
  const { isSidebarOpen, onToggleSidebar } = useSidebarState();

  return {
    isSidebarOpen,
    onToggleSidebar,
  };
};
