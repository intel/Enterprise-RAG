// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Checkbox } from "@intel-enterprise-rag-ui/components";
import { titleCaseString } from "@intel-enterprise-rag-ui/utils";
import { useDispatch, useSelector } from "react-redux";

import DataIngestionSettingsOption from "@/components/DataIngestionSettingsOption/DataIngestionSettingsOption";
import { END_DATA_STATUSES, POLLING_INTERVAL } from "@/config/api";
import {
  selectIsAutorefreshEnabled,
  setIsAutorefreshEnabled,
} from "@/store/dataIngestionSettings.slice";

const pollingIntervalInSeconds = POLLING_INTERVAL / 1000;

const titleCasedStatuses = END_DATA_STATUSES.map((status) =>
  titleCaseString(status),
).join(", ");

const getDescription = (isAutorefreshEnabled: boolean) =>
  isAutorefreshEnabled
    ? `Automatic data refresh occurs every ${pollingIntervalInSeconds} seconds until all data objects reach one of the following statuses: ${titleCasedStatuses}.`
    : "Autorefresh is currently disabled. Data will not be automatically refreshed.";

export const AutorefreshSettingsOption = () => {
  const isAutorefreshEnabled = useSelector(selectIsAutorefreshEnabled);
  const dispatch = useDispatch();

  const handleChange = (isSelected: boolean) => {
    dispatch(setIsAutorefreshEnabled(isSelected));
  };

  const label = isAutorefreshEnabled ? "Enabled" : "Disabled";
  const description = getDescription(isAutorefreshEnabled);

  return (
    <DataIngestionSettingsOption
      name="Autorefresh"
      input={
        <Checkbox
          data-testid="autorefresh-checkbox"
          name="data-ingestion-autorefresh"
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

export default AutorefreshSettingsOption;
