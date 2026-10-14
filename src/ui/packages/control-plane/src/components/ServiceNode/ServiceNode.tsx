// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { ConfigurableServiceIcon } from "@intel-enterprise-rag-ui/icons";
import { cn } from "@intel-enterprise-rag-ui/utils";
import { Handle } from "@xyflow/react";
import { memo } from "react";

import { ServiceStatusIndicator } from "@/components/ServiceStatusIndicator/ServiceStatusIndicator";
import { ServiceNodeData } from "@/types/index";

interface ServiceNodeProps {
  data: ServiceNodeData;
}

const ServiceNodeComponent = ({
  data: {
    displayName,
    targetPosition,
    sourcePosition,
    additionalTargetPosition,
    additionalTargetId,
    additionalSourcePosition,
    additionalSourceId,
    selected,
    status,
    configurable,
  },
}: ServiceNodeProps) => {
  const serviceNodeClassNames = cn(
    "relative m-2 grid grid-rows-[3rem_1fr] justify-items-center gap-2",
    selected && "text-foreground font-medium",
  );

  return (
    <>
      {targetPosition && (
        <Handle type="target" position={targetPosition} className="invisible" />
      )}
      <div className={serviceNodeClassNames}>
        {configurable && (
          <ConfigurableServiceIcon className="absolute -top-2 -right-3 z-10 text-xs" />
        )}
        <ServiceStatusIndicator
          status={status}
          className={cn(selected && "outline-[0.375rem]")}
          forNode
          noTooltip
        />
        <div className="absolute -bottom-12 flex h-12 min-h-6 w-36 flex-col justify-start">
          <p className="bg-background/70 text-center">{displayName}</p>
        </div>
      </div>
      {sourcePosition && (
        <Handle type="source" position={sourcePosition} className="invisible" />
      )}
      {additionalTargetPosition && additionalTargetId && (
        <Handle
          id={additionalTargetId}
          type="target"
          position={additionalTargetPosition}
          className="invisible"
        />
      )}
      {additionalSourcePosition && additionalSourceId && (
        <Handle
          id={additionalSourceId}
          type="source"
          position={additionalSourcePosition}
          className="invisible"
        />
      )}
    </>
  );
};

export const ServiceNode = memo(ServiceNodeComponent);
