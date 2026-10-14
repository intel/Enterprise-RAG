// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { createPipelineGraphSlice } from "@intel-enterprise-rag-ui/control-plane";

import {
  graphEdges,
  graphNodes,
  llmModelServerNodePositionNoGuards,
  llmNodePositionNoGuards,
} from "@/features/admin-panel/control-plane/config/graph";
import type { RootState } from "@/store/index";

const {
  slice: audioQnAGraphSlice,
  reset,
  setup,
} = createPipelineGraphSlice("audioQnAGraph", graphNodes, graphEdges, {
  llmNodePositionNoGuards,
  llmModelServerNodePositionNoGuards,
});

export { audioQnAGraphSlice };

export const resetAudioQnAGraph = reset;
export const setupAudioQnAGraph = setup;

export const {
  onNodesChange: onAudioQnAGraphNodesChange,
  onEdgesChange: onAudioQnAGraphEdgesChange,
  onConnect: onAudioQnAGraphConnect,
  setEdges: setAudioQnAGraphEdges,
  setNodes: setAudioQnAGraphNodes,
  setIsLoading: setAudioQnAGraphIsLoading,
  setSelectedServiceNode: setAudioQnAGraphSelectedServiceNode,
  setIsRenderable: setAudioQnAGraphIsRenderable,
  setIsAutorefreshEnabled: setAudioQnAGraphIsAutorefreshEnabled,
  resetSlice: resetAudioQnAGraphSlice,
} = audioQnAGraphSlice.actions;

export const audioQnAGraphNodesSelector = (state: RootState) =>
  state.audioQnAGraph.nodes;
export const audioQnAGraphEdgesSelector = (state: RootState) =>
  state.audioQnAGraph.edges;
export const audioQnAGraphIsLoadingSelector = (state: RootState) =>
  state.audioQnAGraph.isLoading;
export const audioQnAGraphSelectedServiceNodeSelector = (state: RootState) =>
  state.audioQnAGraph.selectedServiceNode;
export const audioQnAGraphIsRenderableSelector = (state: RootState) =>
  state.audioQnAGraph.isRenderable;
export const audioQnAGraphIsAutorefreshEnabledSelector = (state: RootState) =>
  state.audioQnAGraph.isAutorefreshEnabled;

export default audioQnAGraphSlice.reducer;
