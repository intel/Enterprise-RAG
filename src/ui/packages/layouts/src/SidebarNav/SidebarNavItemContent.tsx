// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { IconName, icons } from "@intel-enterprise-rag-ui/icons";
import { ReactNode } from "react";

interface SidebarNavItemContentProps {
  /** Icon shown at the start of the row */
  icon?: IconName;
  /** Row label */
  label: string;
  /** Rendered at the end of the row, e.g. an external-link mark or a disclosure chevron */
  trailing?: ReactNode;
  /** Nested-child layout (indented, no gap-1 wrapper) instead of the top-level row layout */
  isChild?: boolean;
}

/**
 * Icon + label (+ optional trailing icon) row, shared by every SidebarNav row type — internal
 * link, external link, and the expand/collapse toggle — so all three stay a real flex row
 * instead of each hand-rolling their own wrapper (a past bug: a plain `flex-1` wrapper with no
 * `flex` let the icon's block-level SVG stack above the label instead of sitting beside it).
 */
export const SidebarNavItemContent = ({
  icon,
  label,
  trailing,
  isChild = false,
}: SidebarNavItemContentProps) => {
  const IconComponent = icon ? icons[icon] : null;

  return (
    <span
      className={
        isChild
          ? "flex flex-1 items-center gap-2 pl-[1.375rem]"
          : "flex flex-1 items-center gap-2"
      }
    >
      {IconComponent && <IconComponent className="size-3.5 shrink-0" />}
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </span>
  );
};
