// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { CopyButton } from "@intel-enterprise-rag-ui/components";
import { Markdown } from "@intel-enterprise-rag-ui/markdown";
import { memo, useState } from "react";

import { ChatTurn } from "@/types";

type UserMessageProps = Pick<ChatTurn, "id" | "question">;

const UserMessage = ({ id, question }: UserMessageProps) => {
  const [showActionButtons, setShowActionButtons] = useState(false);

  const handleMouseEnter = () => {
    setShowActionButtons(true);
  };

  const handleMouseLeave = () => {
    setShowActionButtons(false);
  };

  return (
    <article
      data-testid={`user-message-${id}`}
      className="mx-auto flex w-full flex-row-reverse md:w-[42rem]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex w-full flex-col">
        <div
          className="bg-primary text-primary-foreground mr-9 min-h-[2.5rem] max-w-[calc(100vw_-_10rem)] self-end rounded-lg px-5 py-3 text-sm/relaxed md:mr-0 md:max-w-[40rem]"
          data-testid="user-message__text"
        >
          <Markdown text={question} />
        </div>
        <div className="mr-9 flex h-11 items-center justify-end gap-2 self-end pt-2 md:mr-0">
          <CopyButton textToCopy={question} show={showActionButtons} />
        </div>
      </div>
    </article>
  );
};

export const MemoizedUserMessage = memo(UserMessage);
