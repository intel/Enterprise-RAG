// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { InfoIcon } from "@intel-enterprise-rag-ui/icons";
import { cn } from "@intel-enterprise-rag-ui/utils";
import {
  forwardRef,
  HTMLAttributes,
  HTMLInputTypeAttribute,
  useId,
} from "react";

import { Label } from "@/Label/Label";
import { Tooltip } from "@/Tooltip/Tooltip";

type InputSize = "sm";

interface InputProps extends HTMLAttributes<HTMLInputElement> {
  /** Name of the text input */
  name: string;
  /** Value of the text input */
  value: string | string[] | number | undefined;
  /** Label for the text input */
  label?: string;
  /** Input type (e.g., text, password) */
  type?: HTMLInputTypeAttribute;
  /** Size of the text input */
  size?: InputSize;
  /** If true, allows comma separated values */
  isCommaSeparated?: boolean;
  /** If true, disables the input */
  isDisabled?: boolean;
  /** If true, marks the input as invalid */
  isInvalid?: boolean;
  /** If true, makes the input read-only */
  isReadOnly?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Tooltip text for additional info */
  tooltipText?: string;
  /** Error message to display */
  errorMessage?: string;
}

/**
 * Text input component with label, validation, tooltip, and error support.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      name,
      value,
      label,
      className,
      type = "text",
      size,
      isCommaSeparated,
      isDisabled,
      isInvalid,
      isReadOnly,
      placeholder,
      tooltipText,
      errorMessage,
      onChange,
      onKeyDown,
      ...rest
    },
    ref,
  ) => {
    const id = useId();
    const inputId = `${id}-input`;
    const errorId = `${id}-input-error`;

    return (
      <div className={cn("mb-2", className)}>
        {label && (
          <span
            className={cn(
              "mb-2 flex flex-row items-center gap-2",
              size === "sm" && "gap-1",
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
        <input
          ref={ref}
          type={type}
          id={inputId}
          name={name}
          value={value}
          placeholder={placeholder}
          readOnly={isReadOnly}
          disabled={isDisabled}
          aria-describedby={isCommaSeparated ? `${inputId}-hint` : undefined}
          aria-invalid={isInvalid}
          aria-errormessage={isInvalid ? errorId : undefined}
          aria-label={label ? label : name}
          className={cn(
            "border-input bg-background text-foreground caret-foreground h-7 w-full rounded-md border px-2 py-0.5 text-xs/relaxed",
            "placeholder:text-muted-foreground placeholder:not-italic",
            "focus-visible:border-ring focus-visible:ring-ring/30 outline-none focus-visible:ring-2",
            "read-only:pointer-events-none read-only:cursor-default read-only:bg-transparent disabled:pointer-events-none disabled:cursor-default disabled:bg-transparent",
            isInvalid &&
              "border-destructive bg-destructive/10 caret-destructive focus-visible:ring-destructive/30",
            size === "sm" && "px-2 py-1 text-xs",
          )}
          onChange={onChange}
          onKeyDown={onKeyDown}
          {...rest}
        />
        {isCommaSeparated && (
          <span id={`${inputId}-hint`} className="sr-only">
            Enter values separated by commas
          </span>
        )}
        {isInvalid && (
          <span
            id={errorId}
            className={cn(
              "text-destructive block py-2 pl-4 text-sm italic",
              size === "sm" && "pl-2 text-xs",
            )}
          >
            {errorMessage}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
