// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  CaretDownIcon,
  DotsThreeVerticalIcon,
  FileIcon,
  PaperPlaneTiltIcon,
  PlusIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PINNED_ITEMS = [{ id: "p1", name: "Quarterly report summary" }];

const HISTORY_GROUPS = [
  {
    label: "Yesterday",
    items: [{ id: "1", name: "Onboarding FAQ draft" }],
  },
  {
    label: "Sep 10",
    items: [{ id: "2", name: "Guardrails config review", active: true }],
  },
  {
    label: "Older",
    items: [
      { id: "3", name: "Retriever tuning notes" },
      { id: "4", name: "Chunking strategy comparison" },
      { id: "5", name: "Reranker latency investigation" },
      { id: "6", name: "System fingerprint rollout plan" },
    ],
  },
];

const MESSAGES = [
  {
    role: "user" as const,
    text: "What retrieval strategy does this pipeline use by default?",
  },
  {
    role: "assistant" as const,
    text: "The default ChatQnA flavour uses dense retrieval over the configured vector store, with an optional reranker stage before the response is generated.",
    sources: ["deployment/pipelines/chatqna", "docs/reference/architecture.md"],
  },
];

const CHAT_DISCLAIMER =
  "Responses from this solution may require further verification. You are solely responsible for verifying the accuracy of the information provided and how you choose to use it.";

function ChatHistoryItem({ name, active }: { name: string; active?: boolean }) {
  return (
    <button
      className={`group/history-item flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs/relaxed ${
        active ? "ring-ring/50 ring-1" : "hover:bg-muted"
      }`}
    >
      <span className="flex-1 truncate">{name}</span>
      <DotsThreeVerticalIcon className="size-3.5 shrink-0 opacity-0 group-hover/history-item:opacity-100" />
    </button>
  );
}

// Mirrors packages/chat's real SourceDialog trigger — an icon square + filename panel,
// not a pill/label badge (ERAG has no Badge component; nothing in apps/packages uses one).
function SourceChip({ name }: { name: string }) {
  return (
    <span className="bg-secondary inline-flex h-8 items-center overflow-hidden rounded-md">
      <span className="bg-primary text-primary-foreground flex h-full items-center px-2">
        <FileIcon className="size-3.5" />
      </span>
      <span className="truncate px-2 text-xs">{name}</span>
    </span>
  );
}

function ChatHistorySection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="flex flex-col gap-1">
      <button
        className="text-muted-foreground flex items-center gap-1 px-2 text-xs font-medium tracking-wide uppercase"
        onClick={() => setOpen((o) => !o)}
      >
        <CaretDownIcon
          className={`size-3 transition-transform ${open ? "" : "-rotate-90"}`}
        />
        {label}
      </button>
      {open && <div className="flex flex-col gap-0.5">{children}</div>}
    </div>
  );
}

function ChatView() {
  return (
    <div className="ring-foreground/10 flex h-[calc(100vh-4rem)] overflow-hidden rounded-lg ring-1">
      <aside className="flex w-64 shrink-0 flex-col gap-2 border-r border-[color-mix(in_oklch,var(--border),var(--foreground)_50%)] p-3">
        <Button variant="outline" size="sm" className="justify-start gap-1.5">
          <PlusIcon />
          New chat
        </Button>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-3">
            <ChatHistorySection label="Pinned">
              {PINNED_ITEMS.map((item) => (
                <ChatHistoryItem key={item.id} name={item.name} />
              ))}
            </ChatHistorySection>

            {HISTORY_GROUPS.map((group) => (
              <ChatHistorySection key={group.label} label={group.label}>
                {group.items.map((item) => (
                  <ChatHistoryItem
                    key={item.id}
                    name={item.name}
                    active={item.active}
                  />
                ))}
              </ChatHistorySection>
            ))}
          </div>
        </ScrollArea>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground justify-start"
        >
          View all conversations
        </Button>
      </aside>

      <div className="flex flex-1 flex-col">
        <ScrollArea className="flex-1 p-4">
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {MESSAGES.map((message, i) => (
              <div
                key={i}
                className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <div className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full">
                    <SparkleIcon className="size-3.5" />
                  </div>
                )}
                <div
                  className={`flex max-w-md flex-col gap-2 px-3 py-2 text-xs/relaxed ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-lg"
                      : "text-foreground"
                  }`}
                >
                  <p>{message.text}</p>
                  {message.sources && (
                    <div className="flex flex-wrap gap-1">
                      {message.sources.map((source) => (
                        <SourceChip key={source} name={source} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex flex-col gap-2 border-t border-[color-mix(in_oklch,var(--border),var(--foreground)_50%)] p-3">
          <form className="mx-auto flex w-full max-w-2xl items-end gap-2">
            <Textarea
              placeholder="Enter your prompt..."
              rows={1}
              className="flex-1 resize-none"
            />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button size="icon" aria-label="Send prompt">
                    <PaperPlaneTiltIcon />
                  </Button>
                }
              />
              <TooltipContent>Send prompt</TooltipContent>
            </Tooltip>
          </form>
          <p className="text-muted-foreground mx-auto max-w-2xl text-center text-xs">
            {CHAT_DISCLAIMER}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ChatView;
