// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckboxCheckIcon, InfoIcon } from "@intel-enterprise-rag-ui/icons";
import { cn } from "@intel-enterprise-rag-ui/utils";
import { useId } from "react";

import { Label } from "@/Label/Label";
import { Tooltip } from "@/Tooltip/Tooltip";

type CheckboxSize = "sm";
export type CheckboxChangeHandler = (isSelected: boolean) => void;

interface CheckboxProps {
  /** Name of the checkbox input */
  name?: string;
  /** Whether the checkbox is checked */
  isSelected?: boolean;
  /** Whether the checkbox is in an indeterminate state */
  isIndeterminate?: boolean;
  /** If true, the checkbox is disabled */
  isDisabled?: boolean;
  /** If true, the checkbox is read-only */
  isReadOnly?: boolean;
  /** If true, the checkbox is required */
  isRequired?: boolean;
  /** Label for the checkbox input (optional for standalone checkboxes) */
  label?: string;
  /** Size of the checkbox input */
  size?: CheckboxSize;
  /** Tooltip text for additional info */
  tooltipText?: string;
  /** If true, renders checkbox in dense mode */
  dense?: boolean;
  /** Callback for value change */
  onChange: CheckboxChangeHandler;
  /** Accessible label, for standalone checkboxes without a visible label */
  "aria-label"?: string;
  /** Test identifier for automated testing */
  "data-testid"?: string;
}

/**
 * Checkbox input component for boolean selection, with label, tooltip, and dense mode support.
 */
export const Checkbox = ({
  name,
  isSelected,
  isIndeterminate,
  isDisabled,
  isReadOnly,
  isRequired,
  label,
  size,
  tooltipText,
  dense,
  onChange,
  ...rest
}: CheckboxProps) => {
  const inputId = useId();

  return (
    <div
      className={cn(
        "my-4 flex items-center gap-3",
        size === "sm" && "my-3 gap-2",
        dense && "my-0",
        !label && "my-0 gap-0",
      )}
    >
      <CheckboxPrimitive.Root
        {...rest}
        id={inputId}
        name={name}
        checked={isSelected}
        indeterminate={isIndeterminate}
        disabled={isDisabled}
        readOnly={isReadOnly}
        required={isRequired}
        onCheckedChange={onChange}
        className={cn(
          "border-input bg-background relative m-0 flex size-4 items-center justify-center rounded-[4px] border text-xs/relaxed",
          "data-[checked]:bg-primary data-[checked]:text-primary-foreground",
          "data-[readonly]:text-primary data-[readonly]:pointer-events-none data-[readonly]:cursor-default data-[readonly]:bg-transparent data-[readonly]:data-[checked]:bg-transparent",
          "data-[disabled]:text-primary data-[disabled]:pointer-events-none data-[disabled]:cursor-default data-[disabled]:bg-transparent data-[disabled]:data-[checked]:bg-transparent",
          "focus-visible:border-ring focus-visible:ring-ring/30 outline-none focus-visible:ring-2",
          size === "sm" ? "size-3.5" : "cursor-pointer",
        )}
      >
        <CheckboxPrimitive.Indicator>
          <CheckboxCheckIcon aria-hidden="true" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label && (
        <span>
          <Label
            htmlFor={inputId}
            size={size}
            className="relative mb-0 flex flex-row items-center"
          >
            {label}
          </Label>
          {tooltipText && (
            <Tooltip
              title={tooltipText}
              trigger={<InfoIcon />}
              placement="left"
            />
          )}
        </span>
      )}
    </div>
  );
};
