// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { KeycloakService } from "@intel-enterprise-rag-ui/auth";
import type { ThunkAction, UnknownAction } from "@reduxjs/toolkit";
import {
  createApi,
  fetchBaseQuery,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { toast } from "sonner";

import { API_ENDPOINTS, ERROR_MESSAGES } from "@/configs/api";
import { NamespaceStatus } from "@/types/api/namespaceStatus";
import {
  ChangeArgumentsRequest,
  PostRetrieverQueryRequest,
} from "@/types/api/requests";
import {
  GetServiceConfigResponse,
  GetServicesDataResponse,
  GetServicesDetailsResponse,
} from "@/types/api/responses";
import { assembleServicesParameters } from "@/utils/api";
import { createControlPlaneQueryLifecycle } from "@/utils/lifecycle";
import { withScope } from "@/utils/scope";
import { parseServiceDetails } from "@/utils/status";

type DispatchableAction =
  | UnknownAction
  | ThunkAction<unknown, unknown, unknown, UnknownAction>;

export interface CreateControlPlaneApiOptions<T extends string> {
  paramsKeys: readonly string[];
  statusEndpoints: readonly string[];
  mergeStatusResponses?: (responses: NamespaceStatus[]) => NamespaceStatus;
  graphActions: {
    reset: () => DispatchableAction;
    setup: (data: GetServicesDataResponse) => DispatchableAction;
    setLoading: (isLoading: boolean) => DispatchableAction;
    setRenderable: (isRenderable: boolean) => DispatchableAction;
  };
  serviceNameNodeIdMap: Record<string, readonly T[]>;
  serviceNodeIds: readonly T[];
  fallbackErrorMessage: string;
  getErrorMessage: (error: unknown, fallbackMessage: string) => string;
  transformErrorMessage: (
    error: FetchBaseQueryError,
    fallbackMessage: string,
  ) => FetchBaseQueryError;
}

// Every app's control plane RTK Query API follows the same shape: hydrate
// card args from a per-key scoped-config fan-out plus one or more status
// endpoints, then change-arguments/post-retriever-query mutations that reset
// the graph and notify on error. Only the params keys, status endpoint(s),
// graph-slice actions, node-ID maps, and error-message plumbing differ per app.
export function createControlPlaneApi<T extends string>(
  keycloakService: KeycloakService,
  options: CreateControlPlaneApiOptions<T>,
) {
  const {
    paramsKeys,
    statusEndpoints,
    mergeStatusResponses,
    graphActions,
    serviceNameNodeIdMap,
    serviceNodeIds,
    fallbackErrorMessage,
    getErrorMessage,
    transformErrorMessage,
  } = options;

  const controlPlaneBaseQuery = fetchBaseQuery({
    prepareHeaders: async (headers) => {
      await keycloakService.refreshToken();
      return headers;
    },
  });

  return createApi({
    reducerPath: "controlPlaneApi",
    baseQuery: controlPlaneBaseQuery,
    tagTypes: ["Services Data"],
    endpoints: (builder) => ({
      getServicesData: builder.query<GetServicesDataResponse, void>({
        queryFn: async (_arg, _queryApi, _extraOptions, fetchWithBQ) => {
          // Hydrate each card from its own group via the scoped config route,
          // addressing this UI's own pipeline scope so the read reaches its
          // pipeline rather than the fingerprint service default. Refresh once
          // and reuse the token for every request in the per-key fan-out.
          await keycloakService.refreshToken();
          const token = keycloakService.getToken();
          const [groupResults, statusResults] = await Promise.all([
            Promise.all(
              paramsKeys.map((paramsKey) =>
                fetchWithBQ({
                  url: withScope(API_ENDPOINTS.GET_SERVICE_CONFIG, {
                    params_key: paramsKey,
                  }),
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }),
              ),
            ),
            Promise.all(
              statusEndpoints.map((endpoint) =>
                fetchWithBQ({
                  url: endpoint,
                  headers: {
                    Authorization: token,
                  },
                }),
              ),
            ),
          ]);

          // A key with no stored row answers 404; that group simply has no
          // card args, so only a non-404 read aborts hydration.
          const parametersError = groupResults
            .map((result) => result.error as FetchBaseQueryError | undefined)
            .find((error) => error && error.status !== 404);

          const statusError = statusResults.find((result) => result.error);

          if (
            parametersError &&
            statusResults.every((result) => result.error)
          ) {
            return {
              error: {
                status: "CUSTOM_ERROR" as const,
                error: ERROR_MESSAGES.GET_SERVICES_DATA,
              },
            };
          }

          if (parametersError) {
            const error = transformErrorMessage(
              parametersError,
              ERROR_MESSAGES.GET_SERVICES_PARAMETERS,
            );
            return { error };
          }

          if (statusError) {
            const error = transformErrorMessage(
              statusError.error as FetchBaseQueryError,
              ERROR_MESSAGES.GET_STATUS,
            );
            return { error };
          }

          const statusData = statusResults.map(
            (result) => result.data as NamespaceStatus,
          );
          const mergedStatus =
            statusData.length > 1
              ? mergeStatusResponses!(statusData)
              : statusData[0];

          const details = parseServiceDetails(
            mergedStatus as GetServicesDetailsResponse,
            {
              serviceNameNodeIdMap,
              serviceNodeIds,
            },
          );

          const parameters = assembleServicesParameters(
            groupResults
              .filter((result) => !result.error)
              .map((result) => result.data as GetServiceConfigResponse),
          );

          return { data: { details, parameters }, error: undefined };
        },
        onQueryStarted: createControlPlaneQueryLifecycle(
          graphActions,
          getErrorMessage,
          fallbackErrorMessage,
        ),
        providesTags: ["Services Data"],
      }),
      changeArguments: builder.mutation<Response, ChangeArgumentsRequest>({
        query: (requestBody) => ({
          url: withScope(API_ENDPOINTS.CHANGE_ARGUMENTS),
          method: "POST",
          body: JSON.stringify(requestBody),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${keycloakService.getToken()}`,
          },
        }),
        onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
          dispatch(graphActions.reset());

          try {
            await queryFulfilled;
          } catch (error) {
            const errorMessage = getErrorMessage(
              (error as { error: FetchBaseQueryError }).error,
              ERROR_MESSAGES.CHANGE_ARGUMENTS,
            );
            toast.error(errorMessage);
          } finally {
            dispatch(graphActions.setLoading(false));
          }
        },
        transformErrorResponse: (error) =>
          transformErrorMessage(error, ERROR_MESSAGES.CHANGE_ARGUMENTS),
        invalidatesTags: ["Services Data"],
      }),
      postRetrieverQuery: builder.mutation<string, PostRetrieverQueryRequest>({
        query: (requestBody) => ({
          url: API_ENDPOINTS.POST_RETRIEVER_QUERY,
          method: "POST",
          body: JSON.stringify(requestBody),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${keycloakService.getToken()}`,
          },
          responseHandler: async (response) => await response.text(),
        }),
        transformErrorResponse: (error) =>
          transformErrorMessage(error, ERROR_MESSAGES.POST_RETRIEVER_QUERY),
      }),
    }),
  });
}
