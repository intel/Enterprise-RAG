// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { IconName, icons } from "@intel-enterprise-rag-ui/icons";
import { cn } from "@intel-enterprise-rag-ui/utils";

export interface ViewSwitchOption {
  /** Stable identifier for this option, also used to determine the currently selected one */
  id: string;
  label: string;
  icon: IconName;
  ariaLabel: string;
  "data-testid"?: string;
}

interface ViewSwitchButtonProps {
  /** The set of views to switch between — rendered in order, one tab per option */
  options: ViewSwitchOption[];
  /** id of the currently selected option */
  selected: string;
  /** Called with the id of the option the user selected (never called for the already-selected one) */
  onSelectionChange: (id: string) => void;
}

/**
 * Tabs-list-styled switch between a fixed set of app views (e.g. Chat / Admin Panel). Purely
 * presentational — apps own the routing/state logic and just pass in options + the current
 * selection.
 */
export const ViewSwitchButton = ({
  options,
  selected,
  onSelectionChange,
}: ViewSwitchButtonProps) => (
  <div className="bg-muted flex w-full items-center rounded-sm">
    {options.map((option) => {
      const IconComponent = icons[option.icon];
      const isSelected = option.id === selected;

      return (
        <button
          key={option.id}
          type="button"
          data-testid={option["data-testid"]}
          aria-label={option.ariaLabel}
          aria-current={isSelected ? "true" : undefined}
          onClick={() => {
            if (!isSelected) {
              onSelectionChange(option.id);
            }
          }}
          className={cn(
            "flex h-6 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-sm px-2 text-xs font-medium whitespace-nowrap transition-all",
            "focus-visible:ring-ring/30 outline-none focus-visible:ring-2",
            isSelected
              ? "bg-background text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <IconComponent className="size-3.5 shrink-0" />
          {option.label}
        </button>
      );
    })}
  </div>
);
