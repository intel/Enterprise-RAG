// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { createPipelineGraphSlice } from "@intel-enterprise-rag-ui/control-plane";

import {
  graphEdges,
  graphNodes,
} from "@/features/admin-panel/control-plane/config/graph";
import type { RootState } from "@/store/index";

const {
  slice: docSumGraphSlice,
  reset,
  setup,
} = createPipelineGraphSlice("docSumGraph", graphNodes, graphEdges, {
  filterEdges: (edges) => edges,
});

export { docSumGraphSlice };

export const resetDocSumGraph = reset;
export const setupDocSumGraph = setup;

export const {
  onNodesChange: onDocSumGraphNodesChange,
  setEdges: setDocSumGraphEdges,
  setNodes: setDocSumGraphNodes,
  setIsLoading: setDocSumGraphIsLoading,
  setSelectedServiceNode: setDocSumGraphSelectedServiceNode,
  setIsRenderable: setDocSumGraphIsRenderable,
  setIsAutorefreshEnabled: setDocSumGraphIsAutorefreshEnabled,
  resetSlice: resetDocSumGraphSlice,
} = docSumGraphSlice.actions;

export const docSumGraphNodesSelector = (state: RootState) =>
  state.docSumGraph.nodes;
export const docSumGraphEdgesSelector = (state: RootState) =>
  state.docSumGraph.edges;
export const docSumGraphIsLoadingSelector = (state: RootState) =>
  state.docSumGraph.isLoading;
export const docSumGraphSelectedServiceNodeSelector = (state: RootState) =>
  state.docSumGraph.selectedServiceNode;
export const docSumGraphIsRenderableSelector = (state: RootState) =>
  state.docSumGraph.isRenderable;
export const docSumGraphIsAutorefreshEnabledSelector = (state: RootState) =>
  state.docSumGraph.isAutorefreshEnabled;

export default docSumGraphSlice.reducer;
