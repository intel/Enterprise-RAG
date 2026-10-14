// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  initializeKeycloak,
  KeycloakEnvKey,
} from "@intel-enterprise-rag-ui/auth";
import { ComponentType, StrictMode } from "react";
import { Container, createRoot } from "react-dom/client";

export const bootstrapApp = (
  AppComponent: ComponentType,
  getAppEnv: (key: KeycloakEnvKey) => string,
  onRefreshTokenFailed: () => void,
  isProd: boolean,
  redirectPath?: string,
  // See initializeKeycloak's own comment: this must be computed by the
  // caller (the app's main.tsx), not here — packages/layouts is also a
  // pre-built library, so import.meta.env would be inlined at this
  // package's own build time, not the consuming app's.
  skipAuth: boolean = false,
) => {
  const renderApp = () => {
    const container = document.getElementById("root") as Container;
    const root = createRoot(container);

    root.render(
      <StrictMode>
        <AppComponent />
      </StrictMode>,
    );
  };

  if (isProd) {
    fetch("/config.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to fetch config.json: ${response.statusText}`,
          );
        }

        return response.json();
      })
      .then((config: Record<string, string>) => {
        window.env = config;
        initializeKeycloak(
          renderApp,
          getAppEnv,
          onRefreshTokenFailed,
          redirectPath,
        );
      })
      .catch((error: unknown) => {
        console.error("Failed to load app configuration:", error);
      });
  } else {
    // skipAuth only ever forwarded on this dev branch — never on the isProd
    // fetch path above, as a second guard beyond the caller's own check.
    initializeKeycloak(
      renderApp,
      getAppEnv,
      onRefreshTokenFailed,
      redirectPath,
      skipAuth,
    );
  }
};
