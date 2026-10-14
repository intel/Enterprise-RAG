// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { useDebug } from "@intel-enterprise-rag-ui/utils";
import { Node } from "@xyflow/react";

import { DocsumCard } from "@/components/cards/DocsumCard";
import { LLMCard } from "@/components/cards/LLMCard";
import { LLMInputGuardCard } from "@/components/cards/LLMInputGuardCard";
import { LLMOutputGuardCard } from "@/components/cards/LLMOutputGuardCard";
import { PromptTemplateCard } from "@/components/cards/PromptTemplateCard/PromptTemplateCard";
import { RerankerCard } from "@/components/cards/RerankerCard";
import { RetrieverCard } from "@/components/cards/RetrieverCard";
import { ChangeArgumentsFunction } from "@/hooks/useServiceCard";
import { PostRetrieverQueryRequest } from "@/types/api/requests";
import { ServiceData } from "@/types/index";
import { validatePromptTemplateForm } from "@/validators/promptTemplateInput";

// Keep in sync with the `cards` keys below — this is the set of node ids ServiceCard can
// actually render a configuration form for. Used by ControlPlaneTab/ControlPlanePanel
// consumers to disable the config panel trigger for a selected-but-not-configurable node
// (e.g. embedding_model_server, vectordb, asr, tts — see GraphNodeId).
export const CONFIGURABLE_SERVICE_IDS = [
  "retriever",
  "reranker",
  "prompt_template",
  "input_guard",
  "llm",
  "output_guard",
  "docsum",
] as const;

export interface ServiceCardProps {
  selectedServiceNode: Node<ServiceData> | null;
  graphNodes?: Node<ServiceData>[];
  changeArguments: ChangeArgumentsFunction;
  isReadOnly?: boolean;
  nerEnabled?: boolean;
  isDebugEnabled?: boolean;
  onPostRetrieverQuery?: (
    request: PostRetrieverQueryRequest,
  ) => Promise<{ data?: unknown; error?: unknown }>;
  onGetErrorMessage?: (error: unknown, defaultMessage: string) => string;
}

export const ServiceCard = ({
  selectedServiceNode,
  graphNodes = [],
  changeArguments,
  isReadOnly = false,
  nerEnabled = false,
  onPostRetrieverQuery,
  onGetErrorMessage,
}: ServiceCardProps) => {
  const { isDebugEnabled } = useDebug();

  const rerankerNode = graphNodes.find((node) => node.id === "reranker");

  if (selectedServiceNode === null) {
    return <NoServiceSelectedCard />;
  }

  const { id, data } = selectedServiceNode;

  const cards: Record<string, JSX.Element> = {
    retriever: (
      <RetrieverCard
        data={data}
        changeArguments={changeArguments}
        isDebugEnabled={isDebugEnabled}
        rerankerArgs={rerankerNode?.data?.rerankerArgs}
        onPostRetrieverQuery={onPostRetrieverQuery}
        onGetErrorMessage={onGetErrorMessage}
        isReadOnly={isReadOnly}
        nerEnabled={nerEnabled}
      />
    ),
    reranker: (
      <RerankerCard
        data={data}
        changeArguments={changeArguments}
        isReadOnly={isReadOnly}
      />
    ),
    prompt_template: (
      <PromptTemplateCard
        data={data}
        changeArguments={changeArguments}
        validatePromptTemplateForm={validatePromptTemplateForm}
        isReadOnly={isReadOnly}
      />
    ),
    input_guard: (
      <LLMInputGuardCard
        data={data}
        changeArguments={changeArguments}
        isReadOnly={isReadOnly}
      />
    ),
    llm: (
      <LLMCard
        data={data}
        changeArguments={changeArguments}
        isReadOnly={isReadOnly}
      />
    ),
    output_guard: (
      <LLMOutputGuardCard
        data={data}
        changeArguments={changeArguments}
        isReadOnly={isReadOnly}
      />
    ),
    docsum: (
      <DocsumCard
        data={data}
        changeArguments={changeArguments}
        isReadOnly={isReadOnly}
      />
    ),
  };

  return cards[id] || null;
};

const NoServiceSelectedCard = () => (
  <div
    data-testid="no-service-selected-card"
    className="bg-card border-l-border flex h-full items-center justify-center border-l"
  >
    <p className="text-foreground w-[14rem] text-center text-sm">
      Select service from the graph to see its details
    </p>
  </div>
);
