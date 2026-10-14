// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { ConfigurableServiceIcon } from "@intel-enterprise-rag-ui/icons";

import { ServiceStatusIndicator } from "@/components/ServiceStatusIndicator/ServiceStatusIndicator";
import { ServiceStatus } from "@/types/index";

export const GraphControls = () => {
  return (
    <div
      className="bg-background/70 absolute z-10 mt-4 ml-[15px] flex flex-col gap-2 rounded p-4"
      data-testid="graph-controls"
    >
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[1rem_1fr] items-center gap-2">
          <ServiceStatusIndicator status={ServiceStatus.Ready} noTooltip />
          <p className="text-foreground m-0 text-xs whitespace-nowrap">Ready</p>
        </div>
        <div className="grid grid-cols-[1rem_1fr] items-center gap-2">
          <ServiceStatusIndicator status={ServiceStatus.NotReady} noTooltip />
          <p className="text-foreground m-0 text-xs whitespace-nowrap">
            Not Ready
          </p>
        </div>
        <div className="grid grid-cols-[1rem_1fr] items-center gap-2">
          <ServiceStatusIndicator
            status={ServiceStatus.NotAvailable}
            noTooltip
          />
          <p className="text-foreground m-0 text-xs whitespace-nowrap">
            Status Not Available
          </p>
        </div>
        <div className="grid grid-cols-[1rem_1fr] items-center gap-2">
          <ConfigurableServiceIcon fontSize={12} />
          <p className="text-foreground m-0 text-xs whitespace-nowrap">
            Configurable Service
          </p>
        </div>
      </div>
    </div>
  );
};
