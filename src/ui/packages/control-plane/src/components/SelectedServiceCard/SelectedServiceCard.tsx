// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Button } from "@intel-enterprise-rag-ui/components";
import { Fragment, MouseEvent, PropsWithChildren, ReactNode } from "react";

import { ServiceStatusIndicator } from "@/components/ServiceStatusIndicator/ServiceStatusIndicator";
import { ServiceDetails, ServiceStatus } from "@/types/index";

export interface SelectedServiceCardFooterProps {
  isConfirmChangesButtonDisabled: boolean;
  onConfirmChangesButtonClick: (event: MouseEvent<HTMLButtonElement>) => void;
  onCancelChangesButtonClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

export interface SelectedServiceCardProps extends PropsWithChildren {
  serviceStatus?: ServiceStatus;
  serviceName: string;
  serviceDetails?: ServiceDetails;
  footerProps?: SelectedServiceCardFooterProps;
  DebugDialog?: ReactNode;
  isReadOnly?: boolean;
}

export const SelectedServiceCard = ({
  serviceStatus,
  serviceName,
  serviceDetails,
  footerProps,
  DebugDialog,
  children,
  isReadOnly = false,
}: SelectedServiceCardProps) => {
  return (
    <div>
      <div className="flex flex-col">
        <header className="bg-card sticky top-0 z-10 grid grid-cols-[1rem_auto] items-center justify-items-start gap-2 pb-2">
          <ServiceStatusIndicator status={serviceStatus} />
          <p className="font-medium">{serviceName}</p>
          {DebugDialog}
        </header>
        <div className="flex flex-col gap-1">
          {serviceDetails && (
            <ServiceDetailsGrid serviceDetails={serviceDetails} />
          )}
          {children}
        </div>
        {footerProps && !isReadOnly && (
          <SelectedServiceCardFooter {...footerProps} />
        )}
      </div>
    </div>
  );
};

interface ServiceDetailsGridProps {
  serviceDetails?: ServiceDetails;
}

const ServiceDetailsGrid = ({ serviceDetails }: ServiceDetailsGridProps) => {
  if (!serviceDetails) {
    return null;
  }

  return (
    <section className="mt-2 grid auto-rows-[1.75rem] grid-cols-2 items-center justify-items-start gap-x-2 gap-y-1">
      {Object.entries(serviceDetails).map(([label, value]) => (
        <Fragment key={label}>
          <p className="text-xs font-medium">{label}</p>
          <p className="w-full overflow-hidden text-xs text-ellipsis whitespace-nowrap">
            {value}
          </p>
        </Fragment>
      ))}
    </section>
  );
};

const SelectedServiceCardFooter = ({
  isConfirmChangesButtonDisabled,
  onConfirmChangesButtonClick,
  onCancelChangesButtonClick,
}: SelectedServiceCardFooterProps) => (
  <footer className="bg-card sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t pt-2">
    <Button
      data-testid="confirm-service-changes-button"
      size="sm"
      variant="success"
      isDisabled={isConfirmChangesButtonDisabled}
      onPress={onConfirmChangesButtonClick}
    >
      Confirm Changes
    </Button>
    <Button
      data-testid="cancel-service-changes-button"
      size="sm"
      variant="outline"
      isDisabled={isConfirmChangesButtonDisabled}
      onPress={onCancelChangesButtonClick}
    >
      Cancel
    </Button>
  </footer>
);
