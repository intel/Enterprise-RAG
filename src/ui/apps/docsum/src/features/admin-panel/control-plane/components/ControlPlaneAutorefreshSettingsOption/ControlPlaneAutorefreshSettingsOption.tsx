// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Checkbox } from "@intel-enterprise-rag-ui/components";

import {
  docSumGraphIsAutorefreshEnabledSelector,
  setDocSumGraphIsAutorefreshEnabled,
} from "@/features/admin-panel/control-plane/store/docSumGraph.slice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const getDescription = (isAutorefreshEnabled: boolean) =>
  isAutorefreshEnabled
    ? "Control Plane status is automatically refreshed every 10 seconds."
    : "Autorefresh is currently disabled. Control Plane status will not be automatically refreshed.";

const ControlPlaneAutorefreshSettingsOption = () => {
  const isAutorefreshEnabled = useAppSelector(
    docSumGraphIsAutorefreshEnabledSelector,
  );
  const dispatch = useAppDispatch();

  const handleChange = (isSelected: boolean) => {
    dispatch(setDocSumGraphIsAutorefreshEnabled(isSelected));
  };

  const label = isAutorefreshEnabled ? "Enabled" : "Disabled";

  return (
    <>
      <p className="text-xs font-medium">Autorefresh</p>
      <Checkbox
        data-testid="control-plane-autorefresh-checkbox"
        name="control-plane-autorefresh"
        label={label}
        size="sm"
        isSelected={isAutorefreshEnabled}
        onChange={handleChange}
        dense
      />
      <p className="text-xs">{getDescription(isAutorefreshEnabled)}</p>
    </>
  );
};

export default ControlPlaneAutorefreshSettingsOption;
