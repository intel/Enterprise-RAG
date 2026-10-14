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
import { FitViewOptions, Node, NodeChange } from "@xyflow/react";
import { useCallback, useEffect, useMemo } from "react";

import {
  useChangeArgumentsMutation,
  useGetServicesDataQuery,
  useLazyGetServicesDataQuery,
  usePostRetrieverQueryMutation,
} from "@/features/admin-panel/control-plane/api";
import {
  chatQnAGraphEdgesSelector,
  chatQnAGraphIsAutorefreshEnabledSelector,
  chatQnAGraphIsLoadingSelector,
  chatQnAGraphIsRenderableSelector,
  chatQnAGraphNodesSelector,
  chatQnAGraphSelectedServiceNodeSelector,
  onChatQnAGraphConnect,
  onChatQnAGraphEdgesChange,
  onChatQnAGraphNodesChange,
  setChatQnAGraphSelectedServiceNode,
} from "@/features/admin-panel/control-plane/store/chatQnAGraph.slice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { getChatQnAAppEnv } from "@/utils";
import { getErrorMessage } from "@/utils/api";

const ChatQnAControlPlaneTab = () => {
  useGetServicesDataQuery();

  const dispatch = useAppDispatch();
  const isLoading = useAppSelector(chatQnAGraphIsLoadingSelector);
  const isRenderable = useAppSelector(chatQnAGraphIsRenderableSelector);
  const isAutorefreshEnabled = useAppSelector(
    chatQnAGraphIsAutorefreshEnabledSelector,
  );
  const nodes = useAppSelector(chatQnAGraphNodesSelector);
  const edges = useAppSelector(chatQnAGraphEdgesSelector);
  const selectedServiceNode = useAppSelector(
    chatQnAGraphSelectedServiceNodeSelector,
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
      dispatch(setChatQnAGraphSelectedServiceNode([]));
    };
  }, [dispatch]);

  const handleSelectionChange = useCallback(
    ({ nodes }: { nodes: Node<Record<string, unknown>>[] }) => {
      dispatch(
        setChatQnAGraphSelectedServiceNode(nodes as Node<ServiceData>[]),
      );
    },
    [dispatch],
  );

  const handleNodesChange = (
    changes: NodeChange<Node<Record<string, unknown>>>[],
  ) => {
    dispatch(
      onChatQnAGraphNodesChange(changes as NodeChange<Node<ServiceData>>[]),
    );
  };

  const fitViewOptions: FitViewOptions = useMemo(
    () => ({
      padding: nodes.length > 9 ? 0.25 : 0.5,
    }),
    [nodes.length],
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
      onEdgesChange={onChatQnAGraphEdgesChange}
      onConnect={onChatQnAGraphConnect}
      onSelectionChange={handleSelectionChange}
      fitViewOptions={fitViewOptions}
      ConfigPanel={<ChatQnAServiceCard />}
      isConfigPanelDisabled={isConfigPanelDisabled}
    />
  );
};

const ChatQnAServiceCard = () => {
  const [changeArguments] = useChangeArgumentsMutation();
  const selectedServiceNode = useAppSelector(
    chatQnAGraphSelectedServiceNodeSelector,
  );
  const graphNodes = useAppSelector(chatQnAGraphNodesSelector);
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
      nerEnabled={getChatQnAAppEnv("NER_ENABLED") === "true"}
      onPostRetrieverQuery={handlePostRetrieverQuery}
      onGetErrorMessage={handleGetErrorMessage}
    />
  );
};

export default ChatQnAControlPlaneTab;
