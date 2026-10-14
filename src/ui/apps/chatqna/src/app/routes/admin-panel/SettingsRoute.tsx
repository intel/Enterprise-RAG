// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  AutorefreshSettingsOption,
  ProcessingTimeFormatSettingsOption,
} from "@intel-enterprise-rag-ui/data-ingestion";

import ControlPlaneAutorefreshSettingsOption from "@/features/admin-panel/control-plane/components/ControlPlaneAutorefreshSettingsOption/ControlPlaneAutorefreshSettingsOption";

const SettingsRoute = () => (
  <section className="h-full pb-6" data-testid="settings-view">
    <h2 className="mb-2 text-xl">Settings</h2>
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-sm font-medium">Control Plane</h3>
        <div className="flex flex-col gap-4">
          <ControlPlaneAutorefreshSettingsOption />
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">Data Ingestion</h3>
        <div className="flex flex-col gap-4">
          <AutorefreshSettingsOption />
          <ProcessingTimeFormatSettingsOption />
        </div>
      </div>
    </div>
  </section>
);

export default SettingsRoute;
