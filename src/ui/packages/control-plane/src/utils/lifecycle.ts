// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import type { FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { toast } from "sonner";

import type { GetServicesDataResponse } from "@/types/api/responses";

interface ControlPlaneQueryLifecycleActions {
  reset: () => unknown;
  setup: (data: GetServicesDataResponse) => unknown;
  setLoading: (isLoading: boolean) => unknown;
  setRenderable: (isRenderable: boolean) => unknown;
}

interface ControlPlaneQueryLifecycleApi {
  dispatch: (action: unknown) => unknown;
  queryFulfilled: Promise<{ data: GetServicesDataResponse }>;
  getCacheEntry: () => { data?: GetServicesDataResponse };
}

// Every app's getServicesData onQueryStarted follows the same initial-load
// guard -> reset -> setup -> loading/renderable lifecycle; only the graph-slice
// actions and the fallback error message differ. The fetch logic (queryFn)
// stays app-local.
export function createControlPlaneQueryLifecycle(
  actions: ControlPlaneQueryLifecycleActions,
  getErrorMessage: (error: unknown, fallbackMessage: string) => string,
  fallbackErrorMessage: string,
) {
  return async (
    _arg: void,
    { dispatch, queryFulfilled, getCacheEntry }: ControlPlaneQueryLifecycleApi,
  ) => {
    const cacheEntry = getCacheEntry();
    const isInitialLoad = !cacheEntry?.data;

    if (isInitialLoad) {
      dispatch(actions.reset());
    }

    try {
      const { data } = await queryFulfilled;
      dispatch(actions.setup(data));
    } catch (error) {
      const errorMessage = getErrorMessage(
        (error as { error: FetchBaseQueryError }).error,
        fallbackErrorMessage,
      );
      toast.error(errorMessage);
      dispatch(actions.setRenderable(false));
    } finally {
      if (isInitialLoad) {
        dispatch(actions.setLoading(false));
      }
    }
  };
}
