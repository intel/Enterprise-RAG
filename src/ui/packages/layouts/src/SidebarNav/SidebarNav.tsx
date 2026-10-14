// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  DisclosureIcon,
  ExternalLinkIcon,
  IconName,
} from "@intel-enterprise-rag-ui/icons";
import { cn, isSafeHref, sanitizeHref } from "@intel-enterprise-rag-ui/utils";
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { SidebarMenuItem } from "@/SidebarMenuItem/SidebarMenuItem";
import { SidebarNavItemContent } from "@/SidebarNav/SidebarNavItemContent";

export interface SidebarNavItem {
  name: string;
  id: string;
  /** Internal route path, relative to the nav's basePath — omit for an external link item */
  path?: string;
  /** External URL — when set, renders an anchor (with an external-link icon) instead of a NavLink */
  href?: string;
  /** Icon shown at the start of the row */
  icon?: IconName;
  /** Child items, relative to the same basePath — renders this item as expand/collapse instead */
  children?: SidebarNavItem[];
}

interface SidebarNavProps {
  /** Base path this nav's item paths are relative to, e.g. "/admin-panel" or "/docsum" */
  basePath: string;
  /** Nav items, in order */
  items: SidebarNavItem[];
  /** When true, items whose id is in restrictedItemIds are hidden */
  isMaintainerOnly?: boolean;
  /** ids of items to hide when isMaintainerOnly */
  restrictedItemIds?: string[];
  "aria-label"?: string;
  "data-testid"?: string;
}

const hasActiveChild = (item: SidebarNavItem, pathname: string): boolean =>
  item.children?.some((child) => child.path && pathname.includes(child.path)) ??
  false;

const ExternalLinkItem = ({ item }: { item: SidebarNavItem }) => {
  const isSafe = isSafeHref(item.href!);

  return (
    <a
      href={isSafe ? sanitizeHref(item.href!) : undefined}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${item.name} (opens in new tab)`}
      aria-disabled={!isSafe}
      data-testid={`sidebar-nav-link--${item.id}`}
      className="sidebar-nav__link"
    >
      <SidebarNavItemContent
        icon={item.icon}
        label={item.name}
        trailing={<ExternalLinkIcon className="size-3.5 shrink-0" />}
      />
    </a>
  );
};

const RouteLinkItem = ({
  item,
  basePath,
  isChild = false,
}: {
  item: SidebarNavItem;
  basePath: string;
  isChild?: boolean;
}) => (
  <NavLink
    to={`${basePath}/${item.path}`}
    aria-label={`${item.name} Tab`}
    data-testid={`sidebar-nav-link--${item.id}`}
    className={({ isActive }) =>
      isActive
        ? "sidebar-nav__link sidebar-nav__link--active"
        : "sidebar-nav__link"
    }
  >
    <SidebarNavItemContent
      icon={item.icon}
      label={item.name}
      isChild={isChild}
    />
  </NavLink>
);

const NavItem = ({
  item,
  basePath,
  isChild = false,
}: {
  item: SidebarNavItem;
  basePath: string;
  isChild?: boolean;
}) =>
  item.href ? (
    <ExternalLinkItem item={item} />
  ) : (
    <RouteLinkItem item={item} basePath={basePath} isChild={isChild} />
  );

const NavGroup = ({
  item,
  basePath,
  isExpanded,
  onToggle,
}: {
  item: SidebarNavItem;
  basePath: string;
  isExpanded: boolean;
  onToggle: () => void;
}) => (
  <div className="sidebar-nav__group">
    <SidebarMenuItem
      icon={item.icon}
      label={item.name}
      aria-expanded={isExpanded}
      data-testid={`sidebar-nav-toggle--${item.id}`}
      onPress={onToggle}
      trailing={
        <DisclosureIcon
          className={cn("size-3.5 shrink-0", !isExpanded && "-rotate-90")}
        />
      }
    />
    {isExpanded && (
      <div className="mt-2 flex flex-col gap-1">
        {item.children!.map((child) => (
          <NavItem key={child.id} item={child} basePath={basePath} isChild />
        ))}
      </div>
    )}
  </div>
);

/**
 * Sidebar navigation between a fixed set of sub-views (e.g. admin panel's Control Plane / Data
 * Ingestion / Telemetry, or docsum's Paste Text / Upload File / History). Each leaf entry is a real
 * nested route, not a client-side tab panel. An item with `children` renders as an expand/collapse
 * row instead of navigating itself — its children are the real routes.
 */
export const SidebarNav = ({
  basePath,
  items,
  isMaintainerOnly = false,
  restrictedItemIds = [],
  "aria-label": ariaLabel,
  "data-testid": dataTestId,
}: SidebarNavProps) => {
  const { pathname } = useLocation();
  const visibleItems = isMaintainerOnly
    ? items.filter((item) => !restrictedItemIds.includes(item.id))
    : items;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () =>
      new Set(
        visibleItems
          .filter((item) => hasActiveChild(item, pathname))
          .map((item) => item.id),
      ),
  );

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <nav
      className="flex flex-col gap-[5px]"
      aria-label={ariaLabel}
      data-testid={dataTestId}
    >
      {visibleItems.map((item) =>
        item.children ? (
          <NavGroup
            key={item.id}
            item={item}
            basePath={basePath}
            isExpanded={expandedIds.has(item.id)}
            onToggle={() => toggleExpanded(item.id)}
          />
        ) : (
          <NavItem key={item.id} item={item} basePath={basePath} />
        ),
      )}
    </nav>
  );
};
