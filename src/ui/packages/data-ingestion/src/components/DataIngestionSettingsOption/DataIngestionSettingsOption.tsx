// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./DataIngestionSettingsOption.css";

import { ReactNode } from "react";

interface DataIngestionSettingsOptionProps {
  name: string;
  input: ReactNode;
  description: string;
}

const DataIngestionSettingsOption = ({
  name,
  input,
  description,
}: DataIngestionSettingsOptionProps) => (
  <>
    <p className="data-ingestion-settings-option__name">{name}</p>
    {input}
    <p className="data-ingestion-settings-option__description">{description}</p>
  </>
);

export default DataIngestionSettingsOption;
