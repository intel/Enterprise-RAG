// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { ArrowsClockwiseIcon, GearSixIcon } from "@phosphor-icons/react";
import { useState } from "react";

import { StatusDot } from "@/components/StatusDot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ServiceStatus = "ready" | "not-ready" | "not-available";

const STATUS_LABEL: Record<ServiceStatus, string> = {
  ready: "Ready",
  "not-ready": "Not Ready",
  "not-available": "Status Not Available",
};

const STATUS_COLOR: Record<ServiceStatus, "success" | "error" | "muted"> = {
  ready: "success",
  "not-ready": "error",
  "not-available": "muted",
};

const SERVICES: {
  name: string;
  type: string;
  status: ServiceStatus;
  configurable: boolean;
}[] = [
  {
    name: "embeddings",
    type: "embeddings",
    status: "ready",
    configurable: true,
  },
  {
    name: "retrievers",
    type: "retrievers",
    status: "ready",
    configurable: true,
  },
  { name: "reranks", type: "reranks", status: "not-ready", configurable: true },
  { name: "llms", type: "llms", status: "ready", configurable: true },
  {
    name: "guardrails",
    type: "guardrails",
    status: "not-available",
    configurable: false,
  },
  {
    name: "vectorstores",
    type: "vectorstores",
    status: "ready",
    configurable: false,
  },
];

function ControlPlaneView() {
  const [autorefresh, setAutorefresh] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color-mix(in_oklch,var(--border),var(--foreground)_50%)] p-3">
        <div className="flex flex-wrap items-center gap-4">
          {(Object.keys(STATUS_LABEL) as ServiceStatus[]).map((status) => (
            <StatusDot
              key={status}
              color={STATUS_COLOR[status]}
              label={STATUS_LABEL[status]}
              showLabel
            />
          ))}
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <GearSixIcon className="size-3.5" />
            Configurable Service
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="autorefresh"
              checked={autorefresh}
              onCheckedChange={setAutorefresh}
            />
            <Label htmlFor="autorefresh">Autorefresh Status</Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => {
              setIsFetching(true);
              setTimeout(() => setIsFetching(false), 800);
            }}
          >
            <ArrowsClockwiseIcon className={isFetching ? "animate-spin" : ""} />
            {isFetching ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((service) => (
          <Card key={service.name}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{service.name}</span>
                {service.configurable && (
                  <GearSixIcon className="text-muted-foreground size-3.5" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-muted-foreground">{service.type}</span>
              <StatusDot
                color={STATUS_COLOR[service.status]}
                label={STATUS_LABEL[service.status]}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default ControlPlaneView;
