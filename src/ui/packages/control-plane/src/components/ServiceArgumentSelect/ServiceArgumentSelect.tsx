// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  Select,
  SelectChangeHandler,
} from "@intel-enterprise-rag-ui/components";
import { useEffect, useState } from "react";

import {
  OnArgumentValueChangeHandler,
  ServiceArgumentSelectInputValue,
} from "@/types/index";

interface ServiceArgumentSelectProps {
  name: string;
  value: ServiceArgumentSelectInputValue;
  options: string[];
  tooltipText?: string;
  onArgumentValueChange: OnArgumentValueChangeHandler;
  isDisabled?: boolean;
}

export const ServiceArgumentSelect = ({
  name,
  value,
  options,
  tooltipText,
  onArgumentValueChange,
  isDisabled = false,
}: ServiceArgumentSelectProps) => {
  const [selected, setSelected] =
    useState<ServiceArgumentSelectInputValue>(value);

  useEffect(() => {
    setSelected(value);
  }, [value]);

  const handleChange: SelectChangeHandler<ServiceArgumentSelectInputValue> = (
    item,
  ) => {
    setSelected(item);
    onArgumentValueChange(name, item);
  };

  return (
    <Select
      data-testid={`service-argument-select-input-${name}`}
      value={selected}
      items={options}
      label={name}
      name={name}
      size="sm"
      tooltipText={tooltipText}
      isDisabled={isDisabled}
      onChange={handleChange}
      fullWidth
    />
  );
};
