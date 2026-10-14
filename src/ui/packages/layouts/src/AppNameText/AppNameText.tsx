// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { cn } from "@intel-enterprise-rag-ui/utils";

interface AppNameProps {
  /** Application name to display */
  appName: string;
  className?: string;
}

/**
 * Displays application name.
 */
export const AppNameText = ({ appName, className }: AppNameProps) => (
  <p
    className={cn(
      "text-foreground text-left text-base leading-5 font-bold",
      className,
    )}
  >
    {appName}
  </p>
);
