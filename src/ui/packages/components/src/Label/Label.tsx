// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { cn } from "@intel-enterprise-rag-ui/utils";
import { LabelHTMLAttributes, PropsWithChildren } from "react";

type LabelSize = "sm" | "md";

interface LabelProps
  extends LabelHTMLAttributes<HTMLLabelElement>, PropsWithChildren {
  /** Size of the label (small or medium) */
  size?: LabelSize;
}

/**
 * Label component for form fields and UI elements.
 */
export const Label = ({
  htmlFor,
  size = "md",
  className,
  children,
  ...rest
}: LabelProps) => (
  <label
    htmlFor={htmlFor}
    className={cn(
      "mb-0 text-xs/relaxed font-medium",
      size === "sm" && "text-xs leading-none",
      className,
    )}
    {...rest}
  >
    {children}
  </label>
);
