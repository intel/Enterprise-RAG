// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Outlet } from "react-router-dom";

/**
 * Root layout component providing the main application container.
 * Renders child routes using React Router's Outlet.
 */
export const RootLayout = () => (
  <div className="h-screen w-screen">
    <Outlet />
  </div>
);
