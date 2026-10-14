// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { cn } from "@intel-enterprise-rag-ui/utils";
import { PropsWithChildren, ReactNode } from "react";

import { AppHeader, AppHeaderProps } from "@/AppHeader/AppHeader";

interface PageLayoutProps extends PropsWithChildren {
  /** Props for the application header */
  appHeaderProps: AppHeaderProps;
  /** Configuration for the left sidebar */
  leftSidebar?: {
    /** Component to render in the left sidebar */
    component?: ReactNode;
    /** Whether the left sidebar is open */
    isOpen?: boolean;
  };
  /** Configuration for the right sidebar */
  rightSidebar?: {
    /** Component to render in the right sidebar */
    component?: ReactNode;
    /** Whether the right sidebar is open */
    isOpen?: boolean;
  };
}

/**
 * Page layout component for structuring application pages.
 * Supports header, left/right sidebars, and main content area.
 */
export const PageLayout = ({
  appHeaderProps,
  leftSidebar,
  rightSidebar,
  children,
}: PageLayoutProps) => {
  const { component: LeftSidebar, isOpen: isLeftSidebarOpen } =
    leftSidebar ?? {};
  const { component: RightSidebar, isOpen: isRightSidebarOpen } =
    rightSidebar ?? {};

  return (
    <div className="relative flex h-full w-full flex-row-reverse">
      <div
        className={cn(
          "flex h-full max-w-full flex-1 flex-col overflow-hidden transition-[margin] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isLeftSidebarOpen && "ml-64",
          isRightSidebarOpen && "mr-64",
        )}
      >
        <AppHeader {...appHeaderProps} />
        <main className="flex h-[calc(100vh_-_4rem)] flex-col" id="main">
          {children}
        </main>
      </div>
      {isLeftSidebarOpen && LeftSidebar}
      {isRightSidebarOpen && RightSidebar}
    </div>
  );
};
