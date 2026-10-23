// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./DataIngestionSettingsDialog.css";

import {
  Dialog,
  IconButton,
  Tooltip,
} from "@intel-enterprise-rag-ui/components";

import AutorefreshSettingsOption from "@/components/AutorefreshSettingsOption/AutorefreshSettingsOption";
import ProcessingTimeFormatSettingsOption from "@/components/ProcessingTimeFormatSettingsOption/ProcessingTimeFormatSettingsOption";

const DataIngestionSettingsDialog = () => (
  <Dialog
    data-testid="data-ingestion-settings-dialog"
    trigger={
      <Tooltip
        title="Settings"
        trigger={
          <IconButton
            data-testid="data-ingestion-settings-button"
            icon="settings"
          />
        }
      />
    }
    title="Settings"
    maxWidth={800}
    isCentered
  >
    <div className="data-ingestion-settings">
      <AutorefreshSettingsOption />
      <ProcessingTimeFormatSettingsOption />
    </div>
  </Dialog>
);

export default DataIngestionSettingsDialog;
