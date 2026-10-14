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
  slice: chatQnAGraphSlice,
  reset,
  setup,
} = createPipelineGraphSlice("chatQnAGraph", graphNodes, graphEdges, {
  llmNodePositionNoGuards,
  llmModelServerNodePositionNoGuards,
});

export { chatQnAGraphSlice };

export const resetChatQnAGraph = reset;
export const setupChatQnAGraph = setup;

export const {
  onNodesChange: onChatQnAGraphNodesChange,
  onEdgesChange: onChatQnAGraphEdgesChange,
  onConnect: onChatQnAGraphConnect,
  setEdges: setChatQnAGraphEdges,
  setNodes: setChatQnAGraphNodes,
  setIsLoading: setChatQnAGraphIsLoading,
  setSelectedServiceNode: setChatQnAGraphSelectedServiceNode,
  setIsRenderable: setChatQnAGraphIsRenderable,
  setIsAutorefreshEnabled: setChatQnAGraphIsAutorefreshEnabled,
  resetSlice: resetChatQnAGraphSlice,
} = chatQnAGraphSlice.actions;

export const chatQnAGraphNodesSelector = (state: RootState) =>
  state.chatQnAGraph.nodes;
export const chatQnAGraphEdgesSelector = (state: RootState) =>
  state.chatQnAGraph.edges;
export const chatQnAGraphIsLoadingSelector = (state: RootState) =>
  state.chatQnAGraph.isLoading;
export const chatQnAGraphSelectedServiceNodeSelector = (state: RootState) =>
  state.chatQnAGraph.selectedServiceNode;
export const chatQnAGraphIsRenderableSelector = (state: RootState) =>
  state.chatQnAGraph.isRenderable;
export const chatQnAGraphIsAutorefreshEnabledSelector = (state: RootState) =>
  state.chatQnAGraph.isAutorefreshEnabled;

export default chatQnAGraphSlice.reducer;
