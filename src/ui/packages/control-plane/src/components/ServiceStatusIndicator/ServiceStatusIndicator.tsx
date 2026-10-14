// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Tooltip } from "@intel-enterprise-rag-ui/components";
import { cn } from "@intel-enterprise-rag-ui/utils";

import { ServiceStatus } from "@/types/index";

interface ServiceStatusIndicatorProps {
  status?: ServiceStatus;
  forNode?: boolean;
  noTooltip?: boolean;
  className?: string;
}

export const ServiceStatusIndicator = ({
  status = ServiceStatus.NotAvailable,
  forNode,
  noTooltip,
  className,
}: ServiceStatusIndicatorProps) => {
  const serviceStatusIndicatorClassNames = cn(
    "h-3 w-3 rounded-full",
    status === ServiceStatus.Ready && "bg-success",
    status === ServiceStatus.NotReady && "bg-destructive",
    status === ServiceStatus.NotAvailable && "bg-muted-foreground",
    forNode && "h-12 w-12 outline outline-0 outline-offset-1 transition-all",
    className,
  );

  if (noTooltip) {
    return <div className={serviceStatusIndicatorClassNames}></div>;
  }

  return (
    <Tooltip
      title={status}
      trigger={<div className={serviceStatusIndicatorClassNames}></div>}
      placement={forNode ? "top" : "left"}
    />
  );
};
