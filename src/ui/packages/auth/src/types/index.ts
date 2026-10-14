// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  KeycloakConfig,
  KeycloakInitOptions,
  KeycloakLoginOptions,
} from "keycloak-js";

export type KeycloakEnvKey =
  | "KEYCLOAK_URL"
  | "KEYCLOAK_REALM"
  | "KEYCLOAK_CLIENT_ID"
  | "ADMIN_RESOURCE_ROLE"
  | "MAINTAINER_RESOURCE_ROLE"
  | "USER_RESOURCE_ROLE";

export interface KeycloakServiceConfig {
  keycloakConfig: KeycloakConfig;
  loginOptions?: KeycloakLoginOptions;
  adminResourceRole?: string;
  maintainerResourceRole?: string;
  userResourceRole?: string;
  initOptions?: KeycloakInitOptions;
  minTokenValidity?: number;
  onRefreshTokenFailed?: () => void;
  /**
   * Dev-only escape hatch: skips the real Keycloak check-sso/login flow and
   * grants every resource role, so local automation (axe-core, Lighthouse)
   * can reach authenticated views without following the Keycloak redirect.
   * Callers must only ever set this from a build-time-eliminated dev branch
   * (see `initializeKeycloak`) — never from runtime/production config.
   */
  skipAuth?: boolean;
}
