// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { useColorScheme } from "@intel-enterprise-rag-ui/components";
import {
  Connection,
  Edge,
  EdgeChange,
  FitViewOptions,
  Node,
  NodeChange,
  OnSelectionChangeFunc,
} from "@xyflow/react";
import { ReactNode } from "react";

import { ControlPlanePanel } from "@/components/ControlPlanePanel/ControlPlanePanel";
import { PipelineGraph } from "@/components/PipelineGraph/PipelineGraph";
import { ServiceData } from "@/types/index";

export interface ControlPlaneTabProps {
  nodes: Node<ServiceData>[];
  edges: Edge[];
  isLoading: boolean;
  isRenderable: boolean;
  onRefresh: () => void;
  isFetching: boolean;
  onNodesChange: (changes: NodeChange<Node<ServiceData>>[]) => void;
  onEdgesChange?: (changes: EdgeChange[]) => void;
  onConnect?: (connection: Connection) => void;
  onSelectionChange: OnSelectionChangeFunc;
  fitViewOptions?: FitViewOptions;
  ConfigPanel: ReactNode;
  isConfigPanelDisabled?: boolean;
}

export const ControlPlaneTab = ({
  nodes,
  edges,
  isLoading,
  isRenderable,
  onRefresh,
  isFetching,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onSelectionChange,
  fitViewOptions,
  ConfigPanel,
  isConfigPanelDisabled,
}: ControlPlaneTabProps) => {
  const { colorScheme: colorMode } = useColorScheme();

  const graph = (
    <PipelineGraph
      nodes={nodes}
      edges={edges}
      fitViewOptions={fitViewOptions}
      onNodesChange={
        onNodesChange as (
          changes: NodeChange<Node<Record<string, unknown>>>[],
        ) => void
      }
      onEdgesChange={onEdgesChange}
      onSelectionChange={onSelectionChange}
      onConnect={onConnect}
      colorMode={colorMode}
      onRefresh={onRefresh}
      isFetching={isFetching}
    />
  );

  return (
    <ControlPlanePanel
      isLoading={isLoading}
      isRenderable={isRenderable}
      Graph={graph}
      ConfigPanel={ConfigPanel}
      isConfigPanelDisabled={isConfigPanelDisabled}
    />
  );
};
