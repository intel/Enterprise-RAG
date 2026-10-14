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
import { getDocSumAppEnv } from "@/utils";

const PasteTextTab = lazy(
  () =>
    import("@/features/docsum/components/tabs/paste-text/PasteTextTab/PasteTextTab"),
);
const UploadFileTab = lazy(
  () =>
    import("@/features/docsum/components/tabs/upload-file/UploadFileTab/UploadFileTab"),
);
const HistoryTab = lazy(
  () =>
    import("@/features/docsum/components/tabs/history/HistoryTab/HistoryTab"),
);
const ControlPlaneRoute = lazy(
  () => import("@/app/routes/admin-panel/ControlPlaneRoute"),
);
const SettingsRoute = lazy(
  () => import("@/app/routes/admin-panel/SettingsRoute"),
);
const router = createBrowserRouter([
  {
    path: paths.root,
    element: <Navigate to={`${paths.docsum}/paste-text`} replace />,
    errorElement: <ErrorRoute />,
  },
  {
    path: paths.unauthorized,
    element: <UnauthorizedRoute />,
  },
  {
    element: (
      <AccessGuard
        userRole={getDocSumAppEnv("USER_RESOURCE_ROLE")}
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
            path: paths.docsum,
            children: [
              {
                index: true,
                element: <Navigate to="paste-text" replace />,
              },
              {
                path: "paste-text",
                element: (
                  <Suspense fallback={<LoadingFallback />}>
                    <PasteTextTab />
                  </Suspense>
                ),
              },
              {
                path: "upload-file",
                element: (
                  <Suspense fallback={<LoadingFallback />}>
                    <UploadFileTab />
                  </Suspense>
                ),
              },
              {
                path: "history",
                element: (
                  <Suspense fallback={<LoadingFallback />}>
                    <HistoryTab />
                  </Suspense>
                ),
              },
              {
                path: "*",
                element: <Navigate to="paste-text" replace />,
              },
            ],
          },
          {
            path: paths.adminPanel,
            element: (
              <AdminPanelGuard
                redirectTo={paths.docsum}
                keycloakService={keycloakService}
              >
                <Outlet />
              </AdminPanelGuard>
            ),
            children: [
              {
                index: true,
                element: <Navigate to="control-plane" replace />,
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
