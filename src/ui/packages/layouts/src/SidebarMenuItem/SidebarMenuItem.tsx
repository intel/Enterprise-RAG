// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./SidebarMenuItem.css";

import { IconName } from "@intel-enterprise-rag-ui/icons";
import { cn } from "@intel-enterprise-rag-ui/utils";
import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";

import { SidebarNavItemContent } from "@/SidebarNav/SidebarNavItemContent";

export interface SidebarMenuItemProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "type" | "children"
> {
  /** Icon shown at the start of the row */
  icon?: IconName;
  /** Row label */
  label: string;
  /** Rendered at the end of the row, e.g. a disclosure chevron */
  trailing?: ReactNode;
  /** Highlights the row, matching a SidebarNav link's active state */
  isActive?: boolean;
  onPress: () => void;
  "data-testid"?: string;
}

/**
 * A single sidebar row (icon + label + optional trailing element) on a plain button, styled
 * identically to SidebarNav's own rows (`.sidebar-nav__link`). Use this for any standalone sidebar
 * action — e.g. New Chat — that isn't a route link but should still look like it belongs to the
 * same list as the admin-panel nav items.
 *
 * Forwards its ref and remaining button props, so it can be a Tooltip trigger. `.sidebar-nav__link`
 * is unlayered CSS — className utilities that override its own properties need the `!` modifier.
 */
export const SidebarMenuItem = forwardRef<
  HTMLButtonElement,
  SidebarMenuItemProps
>(
  (
    {
      icon,
      label,
      trailing,
      isActive = false,
      onPress,
      "aria-label": ariaLabel,
      className,
      ...rest
    },
    ref,
  ) => (
    <button
      {...rest}
      ref={ref}
      type="button"
      onClick={onPress}
      aria-label={ariaLabel ?? label}
      className={cn(
        "sidebar-nav__link sidebar-nav__link--toggle",
        "focus-visible:ring-ring/30 outline-none focus-visible:ring-2",
        isActive && "sidebar-nav__link--active",
        className,
      )}
    >
      <SidebarNavItemContent icon={icon} label={label} trailing={trailing} />
    </button>
  ),
);

SidebarMenuItem.displayName = "SidebarMenuItem";
