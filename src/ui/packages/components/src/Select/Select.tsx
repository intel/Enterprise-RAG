// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Select as SelectPrimitive } from "@base-ui/react/select";
import {
  CheckboxCheckIcon,
  InfoIcon,
  SelectInputArrowIcon,
} from "@intel-enterprise-rag-ui/icons";
import { cn } from "@intel-enterprise-rag-ui/utils";
import { type ReactNode, useId } from "react";

import { Label } from "@/Label/Label";
import { Tooltip } from "@/Tooltip/Tooltip";

type SelectSize = "sm";
export type SelectChangeHandler<T extends string = string> = (item: T) => void;

interface SelectProps<T extends string = string> {
  /** Selected value */
  value?: T | null;
  /** List of selectable items */
  items?: string[];
  /** Label for the select input */
  label?: string;
  /** Name of the select input */
  name?: string;
  /** Size of the select input */
  size?: SelectSize;
  /** If true, disables the select input */
  isDisabled?: boolean;
  /** If true, marks the input as invalid */
  isInvalid?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Tooltip text for additional info */
  tooltipText?: string;
  /** If true, select input takes full width */
  fullWidth?: boolean;
  /** Callback for value change */
  onChange?: SelectChangeHandler<T>;
  /** Custom renderer for the selected value displayed in the trigger button */
  renderValue?: (selectedKey: T | null) => ReactNode;
  /** Custom renderer for each list item */
  renderItem?: (item: string) => ReactNode;
  /** Returns the plain-text value used for accessibility/type-ahead when using renderItem */
  getItemTextValue?: (item: string) => string;
  /** Additional CSS classes */
  className?: string;
  /** Accessible label */
  "aria-label"?: string;
  /** Test identifier for automated testing */
  "data-testid"?: string;
}

/**
 * Select input component for choosing from a list of options, with label, validation, and tooltip support.
 */
export const Select = <T extends string = string>({
  items,
  label,
  name,
  size,
  isDisabled,
  isInvalid,
  placeholder,
  tooltipText,
  fullWidth,
  className,
  value,
  onChange,
  renderValue,
  renderItem,
  getItemTextValue,
  ...rest
}: SelectProps<T>) => {
  const inputId = useId();

  return (
    <div className={cn("mb-3", size === "sm" && "mb-2", className)}>
      {label && (
        <span
          className={cn(
            "mb-3 flex flex-row items-center gap-2",
            size === "sm" && "mb-2",
          )}
        >
          {tooltipText && (
            <Tooltip
              title={tooltipText}
              trigger={<InfoIcon aria-hidden="true" />}
              placement="left"
            />
          )}
          <Label htmlFor={inputId} size={size}>
            {label}
          </Label>
        </span>
      )}
      <SelectPrimitive.Root
        name={name}
        value={value ?? null}
        onValueChange={(next) => onChange?.(next as T)}
        disabled={isDisabled}
      >
        <SelectPrimitive.Trigger
          {...rest}
          id={inputId}
          className={cn(
            "border-input bg-background text-foreground flex h-7 items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-xs/relaxed",
            "disabled:pointer-events-none disabled:cursor-default disabled:bg-transparent",
            "focus-visible:border-ring focus-visible:ring-ring/30 outline-none focus-visible:ring-2",
            isInvalid &&
              "border-destructive bg-destructive/10 text-destructive focus-visible:ring-destructive/30",
            fullWidth && "w-full",
            size === "sm" && "h-6 py-0 pr-1 pl-2 text-xs",
          )}
        >
          <SelectPrimitive.Value>
            {(selected: string | null) => {
              if (renderValue) {
                return selected
                  ? renderValue(selected as T)
                  : (placeholder ?? "Select value from the list");
              }
              return selected || placeholder || "Select value from the list";
            }}
          </SelectPrimitive.Value>
          <SelectInputArrowIcon />
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Positioner className="z-[101]">
            <SelectPrimitive.Popup
              className={cn(
                "border-border bg-background text-foreground ring-foreground/10 rounded-lg border shadow-md ring-1",
                "min-w-[var(--anchor-width)]",
              )}
            >
              <SelectPrimitive.List>
                {items?.map((item) => (
                  <SelectPrimitive.Item
                    key={item}
                    value={item}
                    aria-label={
                      getItemTextValue ? getItemTextValue(item) : undefined
                    }
                    className={cn(
                      "hover:bg-secondary flex cursor-pointer items-center justify-between gap-2 px-2 py-1 text-xs/relaxed outline-none first-of-type:rounded-t-md last-of-type:rounded-b-md",
                      "data-[highlighted]:bg-secondary",
                      size === "sm" && "px-2 py-1 text-xs",
                    )}
                  >
                    <SelectPrimitive.ItemText>
                      {renderItem ? renderItem(item) : item}
                    </SelectPrimitive.ItemText>
                    {item === value && (
                      <CheckboxCheckIcon
                        aria-hidden="true"
                        className="size-3 shrink-0"
                      />
                    )}
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.List>
            </SelectPrimitive.Popup>
          </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
};
