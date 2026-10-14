// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  AccessGuard,
  AdminPanelGuard,
  keycloakService,
} from "@intel-enterprise-rag-ui/auth";
import {
  LoadingFallback,
  useColorScheme,
} from "@intel-enterprise-rag-ui/components";
import { TableViewLayout } from "@intel-enterprise-rag-ui/data-ingestion";
import { RootLayout } from "@intel-enterprise-rag-ui/layouts";
import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from "react-router-dom";

import AppShellLayout from "@/app/layouts/AppShellLayout";
import ErrorRoute from "@/app/routes/error/ErrorRoute";
import UnauthorizedRoute from "@/app/routes/unauthorized/UnauthorizedRoute";
import { paths } from "@/config/paths";
import { getChatQnAAppEnv } from "@/utils";

const InitialChatRoute = lazy(
  () => import("@/app/routes/chat/InitialChatRoute"),
);
const ChatConversationRoute = lazy(
  () => import("@/app/routes/chat/ChatConversationRoute"),
);
const AdminPanelIndexRoute = lazy(
  () => import("@/app/routes/admin-panel/AdminPanelIndexRoute"),
);
const ControlPlaneRoute = lazy(
  () => import("@/app/routes/admin-panel/ControlPlaneRoute"),
);
const DataIngestionRoute = lazy(
  () => import("@/app/routes/admin-panel/DataIngestionRoute"),
);
const DataIngestionFilesRoute = lazy(
  () => import("@/app/routes/admin-panel/DataIngestionFilesRoute"),
);
const DataIngestionLinksRoute = lazy(
  () => import("@/app/routes/admin-panel/DataIngestionLinksRoute"),
);
const DataIngestionUploadRoute = lazy(
  () => import("@/app/routes/admin-panel/DataIngestionUploadRoute"),
);
const DataIngestionBucketSyncRoute = lazy(
  () => import("@/app/routes/admin-panel/DataIngestionBucketSyncRoute"),
);
const SettingsRoute = lazy(
  () => import("@/app/routes/admin-panel/SettingsRoute"),
);
const router = createBrowserRouter([
  {
    path: paths.root,
    element: <Navigate to={paths.chat} replace />,
    errorElement: <ErrorRoute />,
  },
  {
    path: paths.unauthorized,
    element: <UnauthorizedRoute />,
  },
  {
    element: (
      <AccessGuard
        userRole={getChatQnAAppEnv("USER_RESOURCE_ROLE")}
        keycloakService={keycloakService}
      >
        <RootLayout />
      </AccessGuard>
    ),
    children: [
      {
        // Owns the app header + sidebar shell once — leaf routes below only swap main content.
        element: <AppShellLayout />,
        children: [
          {
            path: paths.chat,
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <InitialChatRoute />
              </Suspense>
            ),
          },
          {
            path: `${paths.chat}/:chatId`,
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <ChatConversationRoute />
              </Suspense>
            ),
          },
          {
            path: paths.adminPanel,
            element: (
              <AdminPanelGuard
                redirectTo={paths.chat}
                keycloakService={keycloakService}
              >
                <Outlet />
              </AdminPanelGuard>
            ),
            children: [
              {
                index: true,
                element: (
                  <Suspense fallback={<LoadingFallback />}>
                    <AdminPanelIndexRoute />
                  </Suspense>
                ),
              },
              {
                path: "control-plane",
                element: (
                  <Suspense fallback={<LoadingFallback />}>
                    <ControlPlaneRoute />
                  </Suspense>
                ),
              },
              {
                path: "data-ingestion",
                element: (
                  <Suspense fallback={<LoadingFallback />}>
                    <DataIngestionRoute />
                  </Suspense>
                ),
                children: [
                  { index: true, element: <Navigate to="files" replace /> },
                  {
                    element: <TableViewLayout />,
                    children: [
                      {
                        path: "files",
                        element: (
                          <Suspense fallback={<LoadingFallback />}>
                            <DataIngestionFilesRoute />
                          </Suspense>
                        ),
                      },
                      {
                        path: "links",
                        element: (
                          <Suspense fallback={<LoadingFallback />}>
                            <DataIngestionLinksRoute />
                          </Suspense>
                        ),
                      },
                    ],
                  },
                  {
                    path: "upload",
                    element: (
                      <Suspense fallback={<LoadingFallback />}>
                        <DataIngestionUploadRoute />
                      </Suspense>
                    ),
                  },
                  {
                    path: "bucket-sync",
                    element: (
                      <Suspense fallback={<LoadingFallback />}>
                        <DataIngestionBucketSyncRoute />
                      </Suspense>
                    ),
                  },
                ],
              },
              {
                path: "settings",
                element: (
                  <Suspense fallback={<LoadingFallback />}>
                    <SettingsRoute />
                  </Suspense>
                ),
              },
            ],
          },
        ],
      },
      { path: "*", element: <ErrorRoute /> },
    ],
  },
]);

const AppRouter = () => {
  // useColorScheme hook used here to provide color scheme for the app and LoadingFallback component
  useColorScheme();

  return <RouterProvider router={router} />;
};

export default AppRouter;
