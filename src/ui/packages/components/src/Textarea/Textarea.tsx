// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { InfoIcon } from "@intel-enterprise-rag-ui/icons";
import { cn } from "@intel-enterprise-rag-ui/utils";
import { TextareaHTMLAttributes, useId } from "react";

import { Label } from "@/Label/Label";
import { Tooltip } from "@/Tooltip/Tooltip";

type TextareaSize = "sm";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Name of the textarea input */
  name: string;
  /** Value of the textarea input */
  value: string;
  /** Label for the textarea input */
  label?: string;
  /** Size of the textarea input */
  size?: TextareaSize;
  /** Marks the input as invalid */
  isInvalid?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Tooltip text for additional info */
  tooltipText?: string;
}

/**
 * Textarea input component with label, validation, and tooltip support.
 */
export const Textarea = ({
  name,
  value,
  label,
  size,
  isInvalid,
  placeholder,
  tooltipText,
  className,
  ...rest
}: TextareaProps) => {
  const id = useId();
  const inputId = `${id}-textarea`;

  return (
    <div
      className={cn(
        label &&
          (size === "sm"
            ? "grid grid-rows-[1rem_1fr] gap-2"
            : "grid grid-rows-[1.5rem_1fr] gap-2"),
        className,
      )}
    >
      {label && (
        <span
          className={cn(
            "mb-2 flex h-6 flex-row items-center gap-2",
            size === "sm" && "h-4 gap-1",
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
      <textarea
        value={value}
        id={inputId}
        name={name}
        placeholder={placeholder}
        aria-invalid={isInvalid}
        className={cn(
          "border-input bg-background text-foreground caret-foreground h-full w-full resize-none rounded-md border px-2 py-2 text-xs/relaxed",
          "placeholder:text-muted-foreground placeholder:not-italic",
          "focus-visible:border-ring focus-visible:ring-ring/30 outline-none focus-visible:ring-2",
          "read-only:pointer-events-none read-only:cursor-default read-only:bg-transparent disabled:pointer-events-none disabled:cursor-default disabled:bg-transparent",
          isInvalid &&
            "border-destructive bg-destructive/10 caret-destructive focus-visible:ring-destructive/30",
          size === "sm" && "p-2 text-xs",
        )}
        {...rest}
      />
    </div>
  );
};
