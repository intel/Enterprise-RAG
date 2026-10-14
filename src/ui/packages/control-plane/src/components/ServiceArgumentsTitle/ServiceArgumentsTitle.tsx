// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { PropsWithChildren } from "react";

/**
 * Title component for service arguments sections in card components
 */
export const ServiceArgumentsTitle = ({ children }: PropsWithChildren) => (
  <p className="mt-3 mb-2 text-sm font-medium">{children}</p>
);
