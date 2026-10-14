// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Navigate } from "react-router-dom";

import { useAppSelector } from "@/store/hooks";
import { selectLastSelectedAdminTab } from "@/store/viewNavigation.slice";

/** Bare "/admin-panel" redirects to whichever sub-view was last visited, defaulting to Control Plane. */
const AdminPanelIndexRoute = () => {
  const lastSelectedAdminTab = useAppSelector(selectLastSelectedAdminTab);

  return <Navigate to={lastSelectedAdminTab || "control-plane"} replace />;
};

export default AdminPanelIndexRoute;
