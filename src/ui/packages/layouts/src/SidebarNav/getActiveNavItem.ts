// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { SidebarNavItem } from "@/SidebarNav/SidebarNav";

/**
 * Finds the nav item (including nested children) whose route matches the current pathname, for
 * display as the current view's title/icon (e.g. next to the sidebar toggle).
 */
export const getActiveNavItem = (
  items: SidebarNavItem[],
  basePath: string,
  pathname: string,
): SidebarNavItem | undefined => {
  const flatItems = items.flatMap((item) => item.children ?? item);

  return flatItems.find(
    (item) => item.path && pathname.startsWith(`${basePath}/${item.path}`),
  );
};
