// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./TelemetryAuthenticationTab.css";

import { AnchorCard } from "@intel-enterprise-rag-ui/components";

type TelemetryAuthenticationTabProps = {
  grafanaDashboardUrl: string;
  keycloakAdminPanelUrl: string;
};

export const TelemetryAuthenticationTab = ({
  grafanaDashboardUrl,
  keycloakAdminPanelUrl,
}: TelemetryAuthenticationTabProps) => (
  <div className="telemetry-authentication-tab__grid">
    <AnchorCard
      data-testid="grafana-dashboard-link"
      icon="telemetry"
      text="Grafana Dashboard"
      href={grafanaDashboardUrl}
      isExternal
    />
    <AnchorCard
      data-testid="keycloak-admin-panel-link"
      icon="identity-provider"
      text="Keycloak Admin Panel"
      href={keycloakAdminPanelUrl}
      isExternal
    />
  </div>
);
