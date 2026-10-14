// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import Keycloak, { KeycloakLoginOptions } from "keycloak-js";

import { KeycloakServiceConfig } from "@/types";

/**
 * Service class for handling Keycloak authentication and token management.
 */
export class KeycloakService {
  private keycloak: Keycloak | null = null;
  private adminResourceRole: string = "";
  private maintainerResourceRole: string = "";
  private userResourceRole: string = "";
  private loginOptions: KeycloakLoginOptions = {};
  private config?: KeycloakServiceConfig;
  private minTokenValidity: number = 30;
  private onRefreshTokenFailed?: () => void;
  private skipAuth: boolean = false;

  constructor() {}

  /**
   * Sets up the KeycloakService with configuration.
   * @param {KeycloakServiceConfig} config - Configuration object for KeycloakService.
   */
  setup(config: KeycloakServiceConfig) {
    this.config = config;
    this.loginOptions = config.loginOptions || {};
    this.adminResourceRole = config.adminResourceRole ?? "";
    this.maintainerResourceRole = config.maintainerResourceRole ?? "";
    this.userResourceRole = config.userResourceRole ?? "";
    this.minTokenValidity = config.minTokenValidity ?? 30;
    this.onRefreshTokenFailed = config.onRefreshTokenFailed;
    this.skipAuth = config.skipAuth ?? false;

    if (this.skipAuth) {
      console.warn(
        "[KeycloakService] skipAuth is enabled - Keycloak login is bypassed and every resource role is granted. Dev-only; never valid in a production build.",
      );
      return;
    }

    try {
      this.keycloak = new Keycloak(config.keycloakConfig);
    } catch (e) {
      console.error("Failed to initialize Keycloak", e);
    }
  }

  /**
   * Initializes Keycloak and handles authentication.
   * @param {() => void} onAuthenticated - Callback when authentication succeeds.
   * @returns {Promise<void>}
   */
  init = async (onAuthenticated: () => void) => {
    if (!this.config) {
      throw new Error("KeycloakService not configured. Call setup() first.");
    }
    if (this.skipAuth) {
      onAuthenticated();
      return;
    }
    try {
      const isAuthenticated = await this.keycloak?.init({
        onLoad: "check-sso",
        checkLoginIframe: false,
      });
      if (isAuthenticated) {
        onAuthenticated();
      } else {
        this.keycloak?.login(this.loginOptions);
      }
    } catch (error) {
      console.error(error);
      this.keycloak?.login(this.loginOptions);
    }
  };

  /**
   * Redirects the user to the Keycloak login page.
   * @returns {Promise<void>|void}
   */
  redirectToLogin = () => {
    if (this.skipAuth) return;
    this.keycloak?.login(this.loginOptions);
  };

  /**
   * Redirects the user to the Keycloak logout page.
   * @returns {Promise<void>|void}
   */
  redirectToLogout = () => {
    if (this.skipAuth) return;
    this.keycloak?.logout();
  };

  /**
   * Attempts to refresh the Keycloak token. If not authenticated, redirects to login.
   * Calls onRefreshTokenFailed if token refresh fails.
   * @returns {Promise<void>|void}
   */
  refreshToken = async () => {
    if (this.skipAuth) return;
    if (this.keycloak?.authenticated) {
      try {
        await this.keycloak.updateToken(this.minTokenValidity);
      } catch (error) {
        console.error("An error occurred while refreshing the token:", error);
        if (this.onRefreshTokenFailed) {
          this.onRefreshTokenFailed();
        }
      }
    } else {
      console.warn("User is not authenticated. Redirecting to login...");
      this.keycloak?.login(this.loginOptions);
    }
  };

  /**
   * Returns the current Keycloak token string.
   * @returns {string} The token, or an empty string if not available.
   */
  getToken = () =>
    this.skipAuth ? "dev-skip-auth-token" : (this.keycloak?.token ?? "");

  /**
   * Returns the username from the parsed Keycloak token.
   * @returns {string|undefined} The username, if available.
   */
  getUsername = () =>
    this.skipAuth ? "Dev User" : this.keycloak?.tokenParsed?.name;

  /**
   * Returns the email from the parsed Keycloak token.
   * @returns {string|undefined} The email, if available.
   */
  getEmail = () =>
    this.skipAuth ? "dev@localhost" : this.keycloak?.tokenParsed?.email;

  /**
   * Checks if the user has a specific resource role.
   * @param {string} role - The role to check.
   * @returns {boolean} True if user has the role, otherwise false.
   */
  hasResourceRole = (role: string) =>
    this.skipAuth ? true : (this.keycloak?.hasResourceRole(role) ?? false);

  /**
   * Checks if the current user has the admin resource role.
   * @returns {boolean} True if user is admin, otherwise false.
   */
  isAdminUser = () =>
    this.skipAuth ||
    Boolean(
      this.adminResourceRole &&
      this.keycloak?.hasResourceRole(this.adminResourceRole),
    );

  /**
   * Checks if the current user has the maintainer resource role.
   * @returns {boolean} True if user is maintainer, otherwise false.
   */
  isMaintainerUser = () =>
    this.skipAuth ||
    Boolean(
      this.maintainerResourceRole &&
      this.keycloak?.hasResourceRole(this.maintainerResourceRole),
    );

  isUser = () =>
    this.skipAuth ||
    Boolean(
      this.userResourceRole &&
      this.keycloak?.hasResourceRole(this.userResourceRole),
    );
}
