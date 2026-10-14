// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { KeycloakService } from "@/service/keycloak";
import { KeycloakEnvKey, KeycloakServiceConfig } from "@/types";

export const keycloakService = new KeycloakService();

export const initializeKeycloak = (
  onInitialized: () => void,
  getAppEnv: (key: KeycloakEnvKey) => string,
  onRefreshTokenFailed: () => void,
  redirectPath?: string,
  // Dev-only escape hatch for local automation (axe-core, Lighthouse) that
  // cannot follow a real Keycloak redirect. Callers must compute this from
  // their OWN `import.meta.env.DEV && import.meta.env.VITE_SKIP_AUTH` check
  // at their call site, not inside this package: `packages/auth` is
  // pre-built as a library, so `import.meta.env` here would be statically
  // inlined at THIS package's own `vite build` time (always production,
  // never sees an app's `.env.local`) rather than at the consuming app's
  // dev-server runtime — evaluating it here would always be dead code.
  skipAuth: boolean = false,
) => {
  const config: KeycloakServiceConfig = {
    keycloakConfig: {
      url: getAppEnv("KEYCLOAK_URL"),
      realm: getAppEnv("KEYCLOAK_REALM"),
      clientId: getAppEnv("KEYCLOAK_CLIENT_ID"),
    },
    adminResourceRole: getAppEnv("ADMIN_RESOURCE_ROLE"),
    maintainerResourceRole: getAppEnv("MAINTAINER_RESOURCE_ROLE"),
    userResourceRole: getAppEnv("USER_RESOURCE_ROLE"),
    loginOptions: {
      redirectUri: redirectPath
        ? `${location.origin}${redirectPath}`
        : location.origin,
    },
    onRefreshTokenFailed,
    skipAuth,
  };
  keycloakService.setup(config);
  keycloakService.init(onInitialized);
};
