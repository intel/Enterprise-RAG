// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { IconButton, Tooltip } from "@intel-enterprise-rag-ui/components";
import { cn } from "@intel-enterprise-rag-ui/utils";
import { PropsWithChildren, ReactNode } from "react";

type SidebarDirection = "left" | "right";

interface SidebarProps extends PropsWithChildren {
  /** Whether the sidebar is open */
  isOpen: boolean;
  /** Accessible label for navigation */
  ariaLabel?: string;
  /** Content to display in the header */
  headerContent?: ReactNode;
  /** Rendered in its own row above the scrollable content area, matching the app header's height */
  viewSwitchButton?: ReactNode;
  /** Content to display pinned to the bottom, below the scrollable content area */
  footerContent?: ReactNode;
  /** Direction of the sidebar (left or right) */
  direction?: SidebarDirection;
  /** Whether the sidebar has a header */
  hasHeader?: boolean;
}

/**
 * Sidebar navigation component for layout structure.
 * Supports left/right direction, header content, footer content, and open/close state.
 */
export const Sidebar = ({
  isOpen,
  ariaLabel,
  headerContent,
  viewSwitchButton,
  footerContent,
  direction = "right",
  hasHeader = false,
  children,
}: SidebarProps) => (
  <nav
    className={cn(
      "bg-sidebar absolute top-0 z-20 flex h-full w-64 flex-col transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
      isOpen ? "translate-x-0 opacity-100" : "opacity-0",
      direction === "left" && "left-0",
      direction === "left" && !isOpen && "translate-x-64",
      direction === "right" && "right-0",
      direction === "right" && !isOpen && "-translate-x-64",
    )}
    role="navigation"
    aria-label={ariaLabel}
    aria-hidden={!isOpen}
  >
    {isOpen && (
      <>
        {hasHeader && (
          <header className="mx-4 flex h-16 items-center justify-between">
            {headerContent}
          </header>
        )}
        {viewSwitchButton && (
          <div className="mx-2 mt-1 mb-2 flex flex-col gap-1">
            {viewSwitchButton}
          </div>
        )}
        <div className="mx-2 flex-1 overflow-y-auto">{children}</div>
        {footerContent && (
          <footer className="border-border flex h-16 items-center border-t px-4">
            {footerContent}
          </footer>
        )}
      </>
    )}
  </nav>
);

interface SidebarToggleButtonProps {
  isSidebarOpen: boolean;
  sidebarTitle?: string;
  onPress: () => void;
}

export const SidebarToggleButton = ({
  isSidebarOpen,
  sidebarTitle,
  onPress,
}: SidebarToggleButtonProps) => {
  const label = `${isSidebarOpen ? "Close" : "Open"} ${sidebarTitle || "Sidebar"}`;

  return (
    <Tooltip
      title={label}
      trigger={
        <IconButton
          data-testid="sidebar-toggle-button"
          icon="sidebar-toggle"
          aria-label={label}
          onPress={onPress}
        />
      }
      placement="bottom"
    />
  );
};
