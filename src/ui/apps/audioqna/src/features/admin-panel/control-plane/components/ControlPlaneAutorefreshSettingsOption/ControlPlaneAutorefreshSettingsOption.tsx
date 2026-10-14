// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Checkbox } from "@intel-enterprise-rag-ui/components";
import { DataIngestionSettingsOption } from "@intel-enterprise-rag-ui/data-ingestion";

import {
  audioQnAGraphIsAutorefreshEnabledSelector,
  setAudioQnAGraphIsAutorefreshEnabled,
} from "@/features/admin-panel/control-plane/store/audioQnAGraph.slice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const getDescription = (isAutorefreshEnabled: boolean) =>
  isAutorefreshEnabled
    ? "Control Plane status is automatically refreshed every 10 seconds."
    : "Autorefresh is currently disabled. Control Plane status will not be automatically refreshed.";

const ControlPlaneAutorefreshSettingsOption = () => {
  const isAutorefreshEnabled = useAppSelector(
    audioQnAGraphIsAutorefreshEnabledSelector,
  );
  const dispatch = useAppDispatch();

  const handleChange = (isSelected: boolean) => {
    dispatch(setAudioQnAGraphIsAutorefreshEnabled(isSelected));
  };

  const label = isAutorefreshEnabled ? "Enabled" : "Disabled";
  const description = getDescription(isAutorefreshEnabled);

  return (
    <DataIngestionSettingsOption
      name="Autorefresh"
      input={
        <Checkbox
          data-testid="control-plane-autorefresh-checkbox"
          name="control-plane-autorefresh"
          label={label}
          size="sm"
          isSelected={isAutorefreshEnabled}
          onChange={handleChange}
          dense
        />
      }
      description={description}
    />
  );
};

export default ControlPlaneAutorefreshSettingsOption;
