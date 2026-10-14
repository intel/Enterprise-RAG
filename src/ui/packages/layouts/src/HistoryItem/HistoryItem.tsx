// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Tooltip, useInlineRename } from "@intel-enterprise-rag-ui/components";
import { IconName, icons } from "@intel-enterprise-rag-ui/icons";
import { cn } from "@intel-enterprise-rag-ui/utils";
import { ReactNode, useState } from "react";

import { SidebarMenuItem } from "@/SidebarMenuItem/SidebarMenuItem";

export interface HistoryItemMenuRenderProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export interface HistoryItemProps {
  /** Text displayed as the item's title */
  title: string;
  /** If true, the item is rendered as the currently selected one */
  isActive?: boolean;
  /** Callback fired when the item is pressed (not fired while it is already active) */
  onPress: () => void;
  /** Decorative icon shown before the title, e.g. the summarized file's type */
  icon?: IconName;
  /**
   * Interactive control shown before the title, e.g. an unpin button. Occupies the icon slot, so
   * it should be at most 1.25rem square; takes precedence over `icon`.
   */
  leading?: ReactNode;
  /** Renders the item's actions menu; receives the controlled open state */
  renderMenu: (props: HistoryItemMenuRenderProps) => ReactNode;
  /** If provided, double-clicking the title enables inline rename */
  onRename?: (newTitle: string) => void;
  /** Maximum number of characters allowed while renaming */
  renameMaxLength?: number;
  /** Accessible label of the inline rename input */
  renameAriaLabel?: string;
  /** Title length above which the full title is shown in a tooltip */
  titleOverflowLimit?: number;
  /** Additional classes to apply to the item */
  className?: string;
  /** Test identifier; the rename input gets `${data-testid}-title-input` */
  "data-testid"?: string;
}

/**
 * Single row of a history list (chat history, summary history) built on SidebarMenuItem, so it
 * shares the sidebar rows' geometry, with a hover/focus-revealed actions menu and optional
 * double-click inline rename.
 *
 * The title fade blends into `--history-item-bg` (defaults to `--sidebar`) — set it on an
 * ancestor when the list sits on a different surface.
 */
export const HistoryItem = ({
  title,
  isActive = false,
  onPress,
  icon,
  leading,
  renderMenu,
  onRename,
  renameMaxLength,
  renameAriaLabel = "Rename",
  titleOverflowLimit = 12,
  className,
  "data-testid": testId,
}: HistoryItemProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { isEditing, startEditing, inputProps } = useInlineRename({
    value: title,
    onSubmit: (newTitle) => onRename?.(newTitle),
    maxLength: renameMaxLength,
  });

  const handlePress = () => {
    if (isActive) return;
    onPress();
  };

  // A leading control sits in an absolutely positioned slot above the row button, centred on the
  // icon column (1px border + pl-3 + half of size-3.5); the row reserves that column for it:
  // pl-3 + size-3.5 icon + gap-2.
  const rowIcon = leading ? undefined : icon;
  const leadingPadding = leading && "pl-[2.125rem]!";

  let rowElement: ReactNode;
  if (isEditing) {
    const IconComponent = rowIcon ? icons[rowIcon] : null;
    rowElement = (
      <div
        className={cn(
          "border-input bg-background/80 flex h-7 items-center gap-2 rounded border pr-1 pl-3",
          leadingPadding,
        )}
      >
        {IconComponent && <IconComponent className="size-3.5 shrink-0" />}
        <input
          {...inputProps}
          aria-label={renameAriaLabel}
          data-testid={testId && `${testId}-title-input`}
          className="min-w-0 flex-1 border-none bg-transparent text-xs outline-none"
          autoFocus
        />
      </div>
    );
  } else {
    const rowButton = (
      <SidebarMenuItem
        icon={rowIcon}
        label={title}
        isActive={isActive}
        onPress={handlePress}
        onDoubleClick={onRename ? startEditing : undefined}
        aria-current={isActive || undefined}
        className={cn(
          "group-hover/history-item:bg-background/80",
          leadingPadding,
          isMenuOpen && "bg-background/80 border-input!",
        )}
      />
    );
    rowElement =
      title.length > titleOverflowLimit ? (
        <Tooltip title={title} trigger={rowButton} placement="right" />
      ) : (
        rowButton
      );
  }

  return (
    <div
      data-testid={testId}
      className={cn(
        "group/history-item text-foreground relative shrink-0 text-xs",
        "[--history-item-fade:var(--history-item-bg,var(--sidebar))] focus-within:[--history-item-fade:var(--background)] hover:[--history-item-fade:var(--background)]",
        isMenuOpen && "[--history-item-fade:var(--background)]",
        className,
      )}
    >
      {rowElement}
      {leading && (
        <div className="absolute inset-y-0 left-2.5 z-10 flex items-center">
          {leading}
        </div>
      )}
      {!isEditing && (
        <div
          className="pointer-events-none absolute inset-y-px right-px w-11 rounded-r shadow-[inset_-14px_0_10px_-6px_var(--history-item-fade)]"
          aria-hidden="true"
        />
      )}
      <div
        className={cn(
          "absolute inset-y-0 right-0 z-10 flex shrink-0 items-center pr-1 pl-4 opacity-0 transition-opacity",
          "group-focus-within/history-item:opacity-100 group-hover/history-item:opacity-100",
          isMenuOpen && "opacity-100",
        )}
      >
        {renderMenu({ isOpen: isMenuOpen, onOpenChange: setIsMenuOpen })}
      </div>
    </div>
  );
};
