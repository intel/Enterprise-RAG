// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { AiIcon } from "@intel-enterprise-rag-ui/icons";
import { ChangeEventHandler } from "react";

import { ChatDisclaimer } from "@/components/conversation-feed/ChatDisclaimer/ChatDisclaimer";
import { PromptInput } from "@/components/conversation-feed/PromptInput/PromptInput";

interface InitialChatLayoutProps {
  userInput: string;
  disclaimer: string;
  enableMicrophone?: boolean;
  onPromptChange: ChangeEventHandler<HTMLTextAreaElement>;
  onPromptSubmit: () => void;
  onSpeechToText?: (audioBlob: Blob) => Promise<string>;
  onSpeechToTextError?: (error: Error) => void;
}

export const InitialChatLayout = ({
  userInput,
  disclaimer,
  enableMicrophone = false,
  onPromptChange,
  onPromptSubmit,
  onSpeechToText,
  onSpeechToTextError,
}: InitialChatLayoutProps) => (
  <div className="relative mx-auto mb-24 flex h-full w-full max-w-[calc(100%_-_8rem)] flex-col items-center justify-center">
    <div className="mb-9 flex items-start justify-center gap-3">
      <p className="text-foreground text-center text-[2.5rem] leading-[3rem] font-semibold">
        How can I help?
      </p>
      <AiIcon weight="fill" className="text-primary shrink-0 text-[2.5rem]" />
    </div>
    <PromptInput
      prompt={userInput}
      enableMicrophone={enableMicrophone}
      onChange={onPromptChange}
      onSubmit={onPromptSubmit}
      onSpeechToText={onSpeechToText}
      onSpeechToTextError={onSpeechToTextError}
      showSparkAnimation
    />
    <ChatDisclaimer message={disclaimer} />
  </div>
);
