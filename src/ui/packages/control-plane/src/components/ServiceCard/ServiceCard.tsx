// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./ServiceCard.css";

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
    className="no-service-selected-card"
  >
    <p>Select service from the graph to see its details</p>
  </div>
);
