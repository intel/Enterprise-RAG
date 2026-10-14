// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { SelectInputArrowIcon } from "@intel-enterprise-rag-ui/icons";
import { cn } from "@intel-enterprise-rag-ui/utils";

import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/DropdownMenu/DropdownMenu";

export interface DropdownButtonOption {
  value: string;
  label: string;
}

export interface DropdownButtonProps {
  /** Primary button label */
  label: string;
  /** Current selected option value */
  selectedValue: string;
  /** Available options for dropdown */
  options: DropdownButtonOption[];
  /** Callback when primary button is pressed */
  onPress: () => void;
  /** Callback when an option is selected */
  onSelectionChange: (value: string) => void;
  /** Whether the button is disabled */
  isDisabled?: boolean;
  /** Aria label for the dropdown trigger button */
  ariaLabel?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * DropdownButton component combining a primary action button with a dropdown menu for options.
 */
export const DropdownButton = ({
  label,
  selectedValue,
  options,
  onPress,
  onSelectionChange,
  isDisabled = false,
  ariaLabel = "Change selection",
  className,
}: DropdownButtonProps) => {
  const selectedOption = options.find((opt) => opt.value === selectedValue);
  const buttonLabel = selectedOption
    ? `${label} (${selectedOption.label})`
    : label;

  return (
    <div className={cn("relative flex w-full gap-0", className)}>
      <ButtonPrimitive
        className="bg-primary text-primary-foreground disabled:bg-muted disabled:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/30 flex h-7 flex-1 cursor-pointer items-center justify-center gap-1 rounded-l-md px-2 text-xs/relaxed font-medium whitespace-nowrap transition-colors outline-none select-none hover:opacity-90 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onPress}
        disabled={isDisabled}
      >
        {buttonLabel}
      </ButtonPrimitive>
      <DropdownMenuTrigger
        placement="bottom end"
        ariaLabel={ariaLabel}
        trigger={
          <ButtonPrimitive
            className="bg-primary text-primary-foreground disabled:bg-muted disabled:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/30 flex h-7 cursor-pointer items-center justify-center rounded-r-md border-l border-white/20 px-2 transition-colors outline-none select-none hover:opacity-90 focus-visible:ring-2 disabled:cursor-not-allowed disabled:border-transparent disabled:opacity-50"
            disabled={isDisabled}
            aria-label={ariaLabel}
          >
            <SelectInputArrowIcon fontSize={12} />
          </ButtonPrimitive>
        }
      >
        <DropdownMenu
          selectionMode="single"
          selectedKeys={[selectedValue]}
          onSelectionChange={(keys) => onSelectionChange(keys[0])}
        >
          {options.map((option) => (
            <DropdownMenuItem key={option.value} id={option.value}>
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenu>
      </DropdownMenuTrigger>
    </div>
  );
};
