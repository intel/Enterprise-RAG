// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  Button,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@intel-enterprise-rag-ui/components";
import { DeleteIcon, RefreshIcon } from "@intel-enterprise-rag-ui/icons";
import { cn } from "@intel-enterprise-rag-ui/utils";

const menuItemClassName =
  "text-foreground hover:bg-accent flex cursor-pointer items-center gap-2 px-3 py-2";
const disabledMenuItemClassName = "cursor-not-allowed opacity-50";

interface BatchActionsDropdownProps {
  /** Total number of selected items */
  selectedCount: number;
  /** Number of items in error state that can be retried */
  retryableCount: number;
  /** Number of items that need re-ingestion due to embedding model change */
  reingestableCount?: number;
  /** Callback when retry action is clicked */
  onRetry: () => void;
  /** Callback when delete action is clicked */
  onDelete: () => void;
  /** Callback when reingest action is clicked */
  onReingest?: () => void;
  /** Whether the dropdown is disabled */
  isDisabled?: boolean;
}

const BatchActionsDropdown = ({
  selectedCount,
  retryableCount,
  reingestableCount = 0,
  onRetry,
  onDelete,
  onReingest,
  isDisabled = false,
}: BatchActionsDropdownProps) => {
  const isActionsDisabled = isDisabled || selectedCount === 0;
  const isRetryDisabled = retryableCount === 0;
  const isReingestDisabled = reingestableCount === 0;

  return (
    <DropdownMenuTrigger
      trigger={
        <Button
          data-testid="batch-actions-button"
          isDisabled={isActionsDisabled}
        >
          Actions{selectedCount > 0 ? ` (${selectedCount})` : ""}
        </Button>
      }
      ariaLabel="Batch Actions Menu"
      placement="bottom end"
    >
      <DropdownMenu
        className="min-w-40"
        onAction={(key) => {
          if (key === "retry") onRetry();
          if (key === "reingest" && onReingest) onReingest();
          if (key === "delete") onDelete();
        }}
      >
        <DropdownMenuItem
          id="retry"
          className={cn(
            menuItemClassName,
            isRetryDisabled && disabledMenuItemClassName,
          )}
          isDisabled={isRetryDisabled}
        >
          <RefreshIcon className="text-base" />
          <span>Retry{retryableCount > 0 ? ` (${retryableCount})` : ""}</span>
        </DropdownMenuItem>
        {reingestableCount > 0 && onReingest && (
          <DropdownMenuItem
            id="reingest"
            className={cn(
              menuItemClassName,
              isReingestDisabled && disabledMenuItemClassName,
            )}
            isDisabled={isReingestDisabled}
          >
            <RefreshIcon className="text-base" />
            <span>Reingest ({reingestableCount})</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          id="delete"
          className={cn(menuItemClassName, "text-destructive")}
        >
          <DeleteIcon className="text-base" />
          <span>Delete ({selectedCount})</span>
        </DropdownMenuItem>
      </DropdownMenu>
    </DropdownMenuTrigger>
  );
};

export default BatchActionsDropdown;
