// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "@intel-enterprise-rag-ui/utils";

export interface ProgressProps {
  /** Current value */
  value?: number;
  /** Minimum value (defaults to 0) */
  minValue?: number;
  /** Maximum value (defaults to 100) */
  maxValue?: number;
  /** Accessible label */
  "aria-label"?: string;
  /** Additional CSS classes */
  className?: string;
  /** Test identifier for automated testing */
  "data-testid"?: string;
}

/**
 * Progress bar component for visualizing completion percentage.
 */
export const Progress = ({
  value,
  minValue = 0,
  maxValue = 100,
  className,
  ...rest
}: ProgressProps) => {
  const percentage =
    value !== undefined
      ? ((value - minValue) / (maxValue - minValue)) * 100
      : 0;

  return (
    <ProgressPrimitive.Root
      {...rest}
      value={value ?? null}
      min={minValue}
      max={maxValue}
      className={cn(
        "border-input relative h-3 w-32 overflow-hidden rounded-sm border",
        className,
      )}
    >
      <ProgressPrimitive.Track className="bg-background h-full w-full">
        <ProgressPrimitive.Indicator
          className="bg-primary absolute top-0 left-0 h-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
};
