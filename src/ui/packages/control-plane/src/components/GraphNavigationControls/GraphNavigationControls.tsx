// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { IconButton, Tooltip } from "@intel-enterprise-rag-ui/components";
import { FitViewOptions, Panel, useReactFlow } from "@xyflow/react";
import classNames from "classnames";

interface GraphNavigationControlsProps {
  fitViewOptions?: FitViewOptions;
  onRefresh: () => void;
  isFetching: boolean;
}

export const GraphNavigationControls = ({
  fitViewOptions,
  onRefresh,
  isFetching,
}: GraphNavigationControlsProps) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const refreshButtonLabel = isFetching ? "Refreshing..." : "Refresh";

  return (
    <Panel
      position="bottom-left"
      className="bg-background/70 flex items-center gap-1 rounded p-1"
      data-testid="graph-navigation-controls"
    >
      <Tooltip
        title="Zoom in"
        trigger={
          <IconButton
            data-testid="graph-zoom-in-button"
            icon="plus"
            size="sm"
            variant="default"
            aria-label="Zoom in"
            onPress={() => zoomIn()}
          />
        }
      />
      <Tooltip
        title="Zoom out"
        trigger={
          <IconButton
            data-testid="graph-zoom-out-button"
            icon="minus"
            size="sm"
            variant="default"
            aria-label="Zoom out"
            onPress={() => zoomOut()}
          />
        }
      />
      <Tooltip
        title="Fit view"
        trigger={
          <IconButton
            data-testid="graph-fit-view-button"
            icon="fit-view"
            size="sm"
            variant="default"
            aria-label="Fit view"
            onPress={() => fitView(fitViewOptions)}
          />
        }
      />
      <Tooltip
        title={refreshButtonLabel}
        trigger={
          <IconButton
            data-testid="control-plane-refresh-button"
            icon={isFetching ? "loading" : "refresh"}
            iconClassName={classNames({ "animate-spin": isFetching })}
            size="sm"
            variant="default"
            isDisabled={isFetching}
            aria-label={refreshButtonLabel}
            onPress={onRefresh}
          />
        }
      />
    </Panel>
  );
};
