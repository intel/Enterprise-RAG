// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cn } from "@intel-enterprise-rag-ui/utils";

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        // Mirrors shadcn-preset's separator: --border equals --popover/--secondary, so a
        // plain bg-border line would vanish on those surfaces; 50% --foreground keeps it
        // visible in both modes.
        "shrink-0 bg-[color-mix(in_oklch,var(--border),var(--foreground)_50%)] data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
