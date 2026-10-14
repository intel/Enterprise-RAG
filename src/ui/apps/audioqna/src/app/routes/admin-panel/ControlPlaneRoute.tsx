// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from "react";

import ControlPlaneTab from "@/features/admin-panel/control-plane/components/ControlPlaneTab/ControlPlaneTab";
import { useAppDispatch } from "@/store/hooks";
import { setLastSelectedAdminTab } from "@/store/viewNavigation.slice";

const ControlPlaneRoute = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setLastSelectedAdminTab("control-plane"));
  }, [dispatch]);

  return <ControlPlaneTab />;
};

export default ControlPlaneRoute;
