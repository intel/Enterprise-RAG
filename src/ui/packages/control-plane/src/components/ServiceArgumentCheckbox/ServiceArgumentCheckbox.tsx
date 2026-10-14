// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  Checkbox,
  CheckboxChangeHandler,
} from "@intel-enterprise-rag-ui/components";
import { useCallback, useEffect, useState } from "react";

import {
  OnArgumentValueChangeHandler,
  ServiceArgumentCheckboxValue,
} from "@/types/index";

interface ServiceArgumentCheckboxProps {
  value: ServiceArgumentCheckboxValue;
  name: string;
  /** Overrides the visible label; falls back to `name` (e.g. when this checkbox doubles as a panel's expand/collapse control) */
  label?: string;
  tooltipText?: string;
  onArgumentValueChange: OnArgumentValueChangeHandler;
  isDisabled?: boolean;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
}

export const ServiceArgumentCheckbox = ({
  value,
  name,
  label,
  tooltipText,
  onArgumentValueChange,
  isDisabled = false,
  ...rest
}: ServiceArgumentCheckboxProps) => {
  const [isSelected, setIsSelected] =
    useState<ServiceArgumentCheckboxValue>(value);

  useEffect(() => {
    setIsSelected(value);
  }, [value]);

  const handleChange: CheckboxChangeHandler = useCallback(
    (isSelected) => {
      setIsSelected(isSelected);
      onArgumentValueChange(name, isSelected);
    },
    [name, onArgumentValueChange],
  );

  return (
    <Checkbox
      {...rest}
      data-testid={`service-argument-checkbox-${name}`}
      label={label ?? name}
      size="sm"
      tooltipText={tooltipText}
      isSelected={isSelected}
      isDisabled={isDisabled}
      name={name}
      onChange={handleChange}
    />
  );
};
