// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@intel-enterprise-rag-ui/utils";
import { ReactNode, RefObject } from "react";

import { parsePlacement } from "@/lib/placement";

interface PopoverProps extends Omit<PopoverPrimitive.Popup.Props, "children"> {
  /** Accessible label for the popover dialog */
  ariaLabel?: string;
  /** Content to display inside the popover */
  children: ReactNode;
  /** If true, popover is open */
  isOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (isOpen: boolean) => void;
  /** Ref of the element the popover is anchored to */
  triggerRef?: RefObject<Element | null>;
  /** Placement of the popover relative to its trigger (e.g. "top", "bottom end") */
  placement?: string;
  /** Distance in pixels between the trigger and the popover */
  offset?: number;
}

/**
 * Popover component for displaying content in a floating dialog.
 */
export const Popover = ({
  ariaLabel,
  children,
  isOpen,
  onOpenChange,
  triggerRef,
  placement,
  offset = 8,
  className,
  ...rest
}: PopoverProps) => {
  const { side, align } = parsePlacement(placement);

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={triggerRef}
          side={side}
          align={align}
          sideOffset={offset}
          className="z-[101]"
        >
          <PopoverPrimitive.Popup
            aria-label={ariaLabel}
            className={cn(
              "bg-popover text-popover-foreground ring-foreground/10 rounded-lg p-2.5 text-xs/relaxed shadow-md ring-1",
              className,
            )}
            {...rest}
          >
            {children}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};

export type { PopoverProps };
