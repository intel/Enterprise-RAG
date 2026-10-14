// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { PropsWithChildren } from "react";

/**
 * Title component for scanner arguments sections in guard card components
 */
export const ScannersArgumentsTitle = ({ children }: PropsWithChildren) => (
  <p className="my-1 text-sm font-medium">{children}</p>
);
