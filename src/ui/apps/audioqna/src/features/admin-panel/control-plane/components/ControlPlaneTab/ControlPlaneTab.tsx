// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { keycloakService } from "@intel-enterprise-rag-ui/auth";
import {
  CONFIGURABLE_SERVICE_IDS,
  ControlPlaneTab,
  PostRetrieverQueryRequest,
  ServiceCard,
  ServiceData,
  useControlPlanePolling,
} from "@intel-enterprise-rag-ui/control-plane";
import { Node, NodeChange } from "@xyflow/react";
import { useCallback, useEffect, useMemo } from "react";

import {
  useChangeArgumentsMutation,
  useGetServicesDataQuery,
  useLazyGetServicesDataQuery,
  usePostRetrieverQueryMutation,
} from "@/features/admin-panel/control-plane/api";
import {
  audioQnAGraphEdgesSelector,
  audioQnAGraphIsAutorefreshEnabledSelector,
  audioQnAGraphIsLoadingSelector,
  audioQnAGraphIsRenderableSelector,
  audioQnAGraphNodesSelector,
  audioQnAGraphSelectedServiceNodeSelector,
  onAudioQnAGraphConnect,
  onAudioQnAGraphEdgesChange,
  onAudioQnAGraphNodesChange,
  setAudioQnAGraphSelectedServiceNode,
} from "@/features/admin-panel/control-plane/store/audioQnAGraph.slice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { getAudioQnAAppEnv } from "@/utils";
import { getErrorMessage } from "@/utils/api";

const AudioQnAControlPlaneTab = () => {
  useGetServicesDataQuery();

  const dispatch = useAppDispatch();
  const isLoading = useAppSelector(audioQnAGraphIsLoadingSelector);
  const isRenderable = useAppSelector(audioQnAGraphIsRenderableSelector);
  const isAutorefreshEnabled = useAppSelector(
    audioQnAGraphIsAutorefreshEnabledSelector,
  );
  const nodes = useAppSelector(audioQnAGraphNodesSelector);
  const edges = useAppSelector(audioQnAGraphEdgesSelector);
  const selectedServiceNode = useAppSelector(
    audioQnAGraphSelectedServiceNodeSelector,
  );
  const isConfigPanelDisabled =
    selectedServiceNode === null ||
    !CONFIGURABLE_SERVICE_IDS.includes(
      selectedServiceNode.id as (typeof CONFIGURABLE_SERVICE_IDS)[number],
    );

  const [getServicesData, { isFetching }] = useLazyGetServicesDataQuery();

  const handleRefresh = useCallback(() => {
    getServicesData();
  }, [getServicesData]);

  useControlPlanePolling(handleRefresh, isAutorefreshEnabled);

  useEffect(() => {
    return () => {
      dispatch(setAudioQnAGraphSelectedServiceNode([]));
    };
  }, [dispatch]);

  const handleSelectionChange = useCallback(
    ({ nodes }: { nodes: Node<Record<string, unknown>>[] }) => {
      dispatch(
        setAudioQnAGraphSelectedServiceNode(nodes as Node<ServiceData>[]),
      );
    },
    [dispatch],
  );

  const handleNodesChange = (
    changes: NodeChange<Node<Record<string, unknown>>>[],
  ) => {
    dispatch(
      onAudioQnAGraphNodesChange(changes as NodeChange<Node<ServiceData>>[]),
    );
  };

  const fitViewOptions = useMemo(
    () => ({
      padding: {
        x: 0.75,
        y: 0.5,
      },
    }),
    [],
  );

  return (
    <ControlPlaneTab
      nodes={nodes}
      edges={edges}
      isLoading={isLoading}
      isRenderable={isRenderable}
      onRefresh={handleRefresh}
      isFetching={isFetching}
      onNodesChange={handleNodesChange}
      onEdgesChange={onAudioQnAGraphEdgesChange}
      onConnect={onAudioQnAGraphConnect}
      onSelectionChange={handleSelectionChange}
      fitViewOptions={fitViewOptions}
      ConfigPanel={<AudioQnAServiceCard />}
      isConfigPanelDisabled={isConfigPanelDisabled}
    />
  );
};

const AudioQnAServiceCard = () => {
  const [changeArguments] = useChangeArgumentsMutation();
  const selectedServiceNode = useAppSelector(
    audioQnAGraphSelectedServiceNodeSelector,
  );
  const graphNodes = useAppSelector(audioQnAGraphNodesSelector);
  const [postRetrieverQuery] = usePostRetrieverQueryMutation();

  const handlePostRetrieverQuery = async (
    request: PostRetrieverQueryRequest,
  ) => {
    return await postRetrieverQuery(request);
  };

  const handleGetErrorMessage = (error: unknown, defaultMessage: string) => {
    return getErrorMessage(error, defaultMessage);
  };

  const isReadOnly =
    keycloakService.isMaintainerUser() && !keycloakService.isAdminUser();

  return (
    <ServiceCard
      selectedServiceNode={selectedServiceNode}
      graphNodes={graphNodes}
      changeArguments={changeArguments}
      isReadOnly={isReadOnly}
      nerEnabled={getAudioQnAAppEnv("NER_ENABLED") === "true"}
      onPostRetrieverQuery={handlePostRetrieverQuery}
      onGetErrorMessage={handleGetErrorMessage}
    />
  );
};

export default AudioQnAControlPlaneTab;
