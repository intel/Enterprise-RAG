// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { keycloakService } from "@intel-enterprise-rag-ui/auth";
import { FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { toast } from "sonner";

import { AppDispatch } from "@/store";
import { resetStore } from "@/store/utils";

const getErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (typeof error === "object" && error !== null) {
    const fetchError = error as FetchBaseQueryError;

    if (typeof fetchError.status === "number") {
      if (typeof fetchError.data === "object" && fetchError.data !== null) {
        if (
          "message" in fetchError.data &&
          typeof fetchError.data.message === "string"
        ) {
          return fetchError.data.message;
        } else if (
          "detail" in fetchError.data &&
          typeof fetchError.data.detail === "string"
        ) {
          return fetchError.data.detail;
        }
      }

      return JSON.stringify(fetchError.data);
    } else if (
      "originalStatus" in fetchError &&
      typeof fetchError.originalStatus === "number"
    ) {
      if (fetchError.originalStatus === 429) {
        return "Too many requests. Please try again later.";
      }

      return fetchError.error;
    } else if ("error" in fetchError) {
      return fetchError.error;
    }
  }

  return fallbackMessage;
};

const handleOnQueryStarted = async <T>(
  queryFulfilled: Promise<T>,
  // No longer used for dispatching a notification (that's a direct toast() call
  // now, not a Redux action) — kept so every RTK Query onQueryStarted call site
  // doesn't need updating just to drop this argument.
  _dispatch: AppDispatch,
  fallbackMessage: string,
) => {
  try {
    await queryFulfilled;
  } catch (error) {
    const errorMessage = getErrorMessage(
      (error as { error: FetchBaseQueryError }).error,
      fallbackMessage,
    );
    toast.error(errorMessage);
  }
};

const onRefreshTokenFailed = () => {
  resetStore();
  keycloakService.redirectToLogout();
};

const transformErrorMessage = (
  error: FetchBaseQueryError,
  fallbackMessage: string,
): FetchBaseQueryError => {
  if (error.status === "FETCH_ERROR") {
    return { ...error, error: fallbackMessage };
  } else {
    return error;
  }
};

export {
  getErrorMessage,
  handleOnQueryStarted,
  onRefreshTokenFailed,
  transformErrorMessage,
};
