// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  AlertDialog,
  Button,
  Tooltip,
} from "@intel-enterprise-rag-ui/components";
import { Fragment, ReactNode } from "react";

const SOURCE_DIALOG_TITLE_CHAR_LIMIT = 50; // used to truncate long source names for dialog title

interface SourceDialogProps {
  name: string;
  triggerIcon: ReactNode;
  actionLabel: string;
  citations?: string[];
  className?: string;
  onAction: () => void;
}

export const SourceDialog = ({
  name,
  triggerIcon,
  actionLabel,
  citations,
  className,
  onAction,
}: SourceDialogProps) => {
  const trigger = (
    <Tooltip
      title="Show details"
      trigger={
        <Button
          data-testid="source-dialog-trigger"
          className={`bg-secondary hover:bg-primary/20 grid h-10 w-full grid-cols-[2.25rem_1fr] items-center gap-0 rounded p-0 ${className ?? ""}`}
        >
          <div className="bg-primary flex h-10 w-9 items-center justify-center rounded-l px-3">
            {triggerIcon}
          </div>
          <div className="text-foreground overflow-hidden pr-3 pl-3 text-xs text-ellipsis whitespace-nowrap">
            {name}
          </div>
        </Button>
      }
    />
  );

  const title =
    name.length > SOURCE_DIALOG_TITLE_CHAR_LIMIT
      ? `${name.slice(0, SOURCE_DIALOG_TITLE_CHAR_LIMIT)}...`
      : name;

  return (
    <AlertDialog
      data-testid="source-dialog"
      title={title}
      trigger={trigger}
      maxWidth={600}
      confirmLabel={actionLabel}
      cancelLabel="Close"
      onConfirm={onAction}
    >
      <div className="mx-2 mt-4 text-sm">
        <h3 className="mb-2! text-base font-semibold!">Citations</h3>
        <div className="mb-4 grid max-h-[50vh] grid-cols-[1.5rem_1fr] items-start gap-3 overflow-y-auto pr-4 [overflow-wrap:anywhere]">
          {citations?.map((text, index) => (
            <Fragment key={`${title}-${index}-citation`}>
              <span className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold">
                {index + 1}
              </span>
              <p
                key={index}
                className="mt-[1px] mb-2 before:content-[open-quote] after:content-[close-quote]"
              >
                {text}
              </p>
            </Fragment>
          ))}
        </div>
      </div>
    </AlertDialog>
  );
};
