// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  Alert,
  AlertDescription,
  CopyButton,
} from "@intel-enterprise-rag-ui/components";
import { ErrorIcon } from "@intel-enterprise-rag-ui/icons";
import { Markdown } from "@intel-enterprise-rag-ui/markdown";
import classNames from "classnames";
import { memo } from "react";

import { AnimatedAiIcon } from "@/components/conversation-feed/AnimatedAiIcon/AnimatedAiIcon";
import {
  PlaySpeechButton,
  PlaySpeechButtonState,
} from "@/components/conversation-feed/PlaySpeechButton/PlaySpeechButton";
import { SourcesGrid } from "@/components/sources/SourcesGrid/SourcesGrid";
import { ChatTurn } from "@/types";

type BotMessageProps = Pick<
  ChatTurn,
  "id" | "answer" | "error" | "isPending" | "sources"
> & {
  playingState?: PlaySpeechButtonState;
  onFileDownload: (
    fileName: string,
    bucketName: string | null,
    siteName: string | null,
  ) => void;
  onPlayMessage?: (turnId: string) => Promise<void>;
};

const BotMessage = ({
  id,
  answer,
  error,
  isPending,
  sources,
  playingState = "idle",
  onFileDownload,
  onPlayMessage,
}: BotMessageProps) => {
  const isWaitingForAnswer = isPending && (answer === "" || error !== null);
  // The raw answer goes to <Markdown>: parseMarkdown sanitizes the rendered HTML, which is the
  // XSS boundary. Sanitizing the markdown source here would mangle code (`->`, `<vector>`).
  const answerText = answer ?? "";
  const showActions = !isPending && (answerText !== "" || error !== null);
  const showSources = showActions && Array.isArray(sources);

  const botResponse =
    error !== null ? (
      <Alert variant="error" className="mt-1" data-testid="bot-message__error">
        <ErrorIcon />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    ) : (
      <div
        className="max-w-[calc(100vw_-_8rem)] text-sm/relaxed md:max-w-[40rem]"
        data-testid="bot-message__text"
      >
        <Markdown text={answerText} />
        {showActions && (
          <footer className="flex items-center justify-start gap-2 pt-3">
            <CopyButton textToCopy={answerText} />
            {onPlayMessage && (
              <PlaySpeechButton
                turnId={id}
                playingState={playingState}
                onPlayMessage={onPlayMessage}
              />
            )}
          </footer>
        )}
        {showSources && (
          <SourcesGrid sources={sources} onFileDownload={onFileDownload} />
        )}
      </div>
    );

  const className = classNames(
    "mx-auto w-full self-start px-9 md:w-[42rem] md:px-0",
    {
      "mb-6": isWaitingForAnswer,
      "mb-8": !isWaitingForAnswer,
    },
  );

  return (
    <div className={className} data-testid={`bot-message-${id}`}>
      {isWaitingForAnswer ? (
        <div className="text-primary flex h-10 w-4 items-center justify-center">
          <AnimatedAiIcon />
        </div>
      ) : (
        botResponse
      )}
    </div>
  );
};

export const MemoizedBotMessage = memo(BotMessage);
