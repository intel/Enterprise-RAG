// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "@intel-enterprise-rag-ui/utils";
import { forwardRef, ReactElement, ReactNode, Ref } from "react";

import { parsePlacement } from "@/lib/placement";

interface TooltipProps {
  /** Tooltip content to display */
  title: ReactNode;
  /** Element that triggers the tooltip */
  trigger: ReactElement;
  /** Placement of the tooltip relative to its trigger (e.g. "top", "bottom end") */
  placement?: string;
  /** Additional classes to apply to the tooltip */
  className?: string;
}

/**
 * Tooltip component for displaying contextual information on hover or focus.
 */
export const Tooltip = forwardRef<HTMLElement, TooltipProps>(
  ({ trigger, title, placement, className, ...rest }, ref) => {
    const { side, align } = parsePlacement(placement);

    return (
      <TooltipPrimitive.Provider delay={200} closeDelay={200}>
        <TooltipPrimitive.Root>
          <TooltipPrimitive.Trigger
            ref={ref as Ref<HTMLButtonElement>}
            render={trigger}
            {...rest}
          />
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Positioner
              side={side}
              align={align}
              sideOffset={8}
              className="z-[101]"
            >
              <TooltipPrimitive.Popup
                className={cn(
                  "bg-foreground text-background m-2 rounded-md px-3 py-1.5 text-xs font-normal [overflow-wrap:anywhere] break-words whitespace-normal drop-shadow-md",
                  className,
                )}
              >
                {title}
              </TooltipPrimitive.Popup>
            </TooltipPrimitive.Positioner>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      </TooltipPrimitive.Provider>
    );
  },
);

Tooltip.displayName = "Tooltip";
