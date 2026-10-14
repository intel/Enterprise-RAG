// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { cn } from "cn";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Mirrors packages/control-plane's real ServiceStatusIndicator — a colored dot, not a
// pill/label badge (ERAG has no Badge component; nothing in apps/packages uses one).
const DOT_COLOR = {
  success: "bg-success",
  error: "bg-destructive",
  muted: "bg-muted-foreground",
} as const;

interface StatusDotProps {
  color: keyof typeof DOT_COLOR;
  label: string;
  showLabel?: boolean;
}

function StatusDot({ color, label, showLabel = false }: StatusDotProps) {
  const dot = (
    <span
      className={cn(
        "inline-block size-3 shrink-0 rounded-full",
        DOT_COLOR[color],
      )}
    />
  );

  if (showLabel) {
    return (
      <span className="inline-flex items-center gap-1.5">
        {dot}
        <span className="text-sm">{label}</span>
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span tabIndex={0} aria-label={label}>
            {dot}
          </span>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export { StatusDot };
