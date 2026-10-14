// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

/**
 * The pre-migration UI library used compound placement strings ("top end", "bottom start").
 * Base UI splits the same concept into separate side/align props with identical
 * start/center/end vocabulary, so this only needs to split on whitespace.
 */
export const parsePlacement = (
  placement?: string,
): { side?: Side; align?: Align } => {
  if (!placement) {
    return {};
  }
  const [side, align] = placement.split(" ") as [Side, Align?];
  return { side, align };
};
