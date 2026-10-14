// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@intel-enterprise-rag-ui/utils";
import { forwardRef, PropsWithChildren } from "react";

export interface SwitchProps extends PropsWithChildren {
  /** Whether the switch is on */
  isSelected?: boolean;
  /** Callback fired when the switch is toggled */
  onChange?: (isSelected: boolean) => void;
  /** If true, the switch is disabled */
  isDisabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Switch component for toggling between on/off states.
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ isSelected, onChange, isDisabled, className, children }, ref) => (
    <label
      className={cn(
        "text-foreground relative mb-0 flex cursor-pointer items-center gap-2",
        className,
      )}
    >
      <SwitchPrimitive.Root
        ref={ref}
        checked={isSelected}
        onCheckedChange={onChange}
        disabled={isDisabled}
        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/30 flex h-[16.6px] w-[28px] items-center rounded-full border-2 border-solid p-[2px] transition-all duration-200 outline-none focus-visible:ring-2"
      >
        <SwitchPrimitive.Thumb className="bg-primary block size-3.5 rounded-full transition-all duration-200 data-[checked]:translate-x-[calc(100%-2px)]" />
      </SwitchPrimitive.Root>
      {children}
    </label>
  ),
);

Switch.displayName = "Switch";
