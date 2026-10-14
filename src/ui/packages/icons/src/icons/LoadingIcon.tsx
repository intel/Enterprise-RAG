// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { CircleNotchIcon, IconProps } from "@phosphor-icons/react";

// Always spins on its own (className merged, not overridden) — callers no longer need to
// add animate-spin themselves.
export const LoadingIcon = ({ className, ...props }: IconProps) => (
  <CircleNotchIcon
    {...props}
    className={["animate-spin", className].filter(Boolean).join(" ")}
  />
);
