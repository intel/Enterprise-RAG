// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { DataIngestionLayout } from "@intel-enterprise-rag-ui/data-ingestion";
import { useEffect } from "react";

import { appApi, selectAppApi } from "@/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setLastSelectedAdminTab } from "@/store/viewNavigation.slice";
import { AppEnvKey } from "@/types";
import { getChatQnAAppEnv } from "@/utils";

/**
 * Layout route for `/admin-panel/data-ingestion` — owns the shared chrome (info/error banners) and
 * renders the active sub-view (files/links/upload/bucket-sync/settings) via its own `<Outlet>`.
 */
const DataIngestionRoute = () => {
  const dispatch = useAppDispatch();

  const appApiState = useAppSelector(selectAppApi);
  const appApiErrors = [
    ...Object.values(appApiState.queries).map((q) => q?.error),
    ...Object.values(appApiState.mutations).map((m) => m?.error),
  ];

  useEffect(() => {
    dispatch(setLastSelectedAdminTab("data-ingestion"));
  }, [dispatch]);

  return (
    <DataIngestionLayout
      getAppEnv={(key) => getChatQnAAppEnv(key as AppEnvKey)}
      appApiErrors={appApiErrors}
      onResetAppApiState={() => dispatch(appApi.util.resetApiState())}
    />
  );
};

export default DataIngestionRoute;
