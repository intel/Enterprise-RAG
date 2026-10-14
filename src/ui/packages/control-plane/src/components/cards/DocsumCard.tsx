// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { SelectedServiceCard } from "@/components/SelectedServiceCard/SelectedServiceCard";
import { ServiceArgumentCheckbox } from "@/components/ServiceArgumentCheckbox/ServiceArgumentCheckbox";
import { ServiceArgumentNumberInput } from "@/components/ServiceArgumentNumberInput/ServiceArgumentNumberInput";
import { ServiceArgumentSelect } from "@/components/ServiceArgumentSelect/ServiceArgumentSelect";
import { ServiceArgumentsTitle } from "@/components/ServiceArgumentsTitle/ServiceArgumentsTitle";
import { DocsumArgs, docsumFormConfig } from "@/configs/services/docsum";
import { useServiceCard } from "@/hooks/useServiceCard";
import { ControlPlaneCardProps } from "@/types/cards";

export const DocsumCard = ({
  data: { id, status, displayName, docsumArgs, details },
  changeArguments,
  isReadOnly = false,
}: ControlPlaneCardProps) => {
  const config = docsumFormConfig;

  const {
    onArgumentValueChange,
    onArgumentValidityChange,
    footerProps,
    argumentsForm,
  } = useServiceCard<DocsumArgs>(id, docsumArgs, { changeArguments });

  return (
    <SelectedServiceCard
      serviceStatus={status}
      serviceName={displayName}
      serviceDetails={details}
      footerProps={footerProps}
      isReadOnly={isReadOnly}
    >
      <ServiceArgumentsTitle>Service Arguments</ServiceArgumentsTitle>
      <ServiceArgumentSelect
        {...config.summary_type}
        value={argumentsForm.summary_type}
        onArgumentValueChange={onArgumentValueChange}
        isDisabled={isReadOnly}
      />
      <ServiceArgumentNumberInput
        {...config.max_new_tokens}
        value={argumentsForm.max_new_tokens}
        onArgumentValueChange={onArgumentValueChange}
        onArgumentValidityChange={onArgumentValidityChange}
        isDisabled={isReadOnly}
      />
      <ServiceArgumentCheckbox
        {...config.stream}
        value={argumentsForm.stream}
        onArgumentValueChange={onArgumentValueChange}
        isDisabled={isReadOnly}
      />
    </SelectedServiceCard>
  );
};
