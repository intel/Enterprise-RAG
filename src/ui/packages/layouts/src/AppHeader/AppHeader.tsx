// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  ColorSchemeSwitch,
  IconButton,
  Tooltip,
  useInlineRename,
} from "@intel-enterprise-rag-ui/components";
import { IconName, icons } from "@intel-enterprise-rag-ui/icons";
import { cn } from "@intel-enterprise-rag-ui/utils";

import { AppNameText } from "@/AppNameText/AppNameText";
import { SidebarToggleButton } from "@/Sidebar/Sidebar";

export interface AppHeaderProps {
  /** When true, the sidebar toggle is hidden */
  maintenanceMode?: boolean;
  /** Whether the sidebar is currently open */
  isSidebarOpen?: boolean;
  /** Called when the sidebar toggle is pressed */
  onToggleSidebar?: () => void;
  /** Title of the current view (chat name or admin-panel section), shown next to the sidebar toggle */
  title?: string;
  /** Icon shown before the title, e.g. the active admin-panel nav item's icon */
  titleIcon?: IconName;
  /** When provided, the title becomes double-click (or rename-icon) editable — e.g. renaming a chat */
  onTitleRename?: (newTitle: string) => void;
}

/**
 * Application header component for layout structure.
 * Account/app-level controls live in the side panel (SidePanelHeader/SidePanelFooter), except for
 * the color scheme switch, which is anchored to the far right of this header instead.
 */
export const AppHeader = ({
  maintenanceMode,
  isSidebarOpen = false,
  onToggleSidebar,
  title,
  titleIcon,
  onTitleRename,
}: AppHeaderProps) => {
  const TitleIcon = titleIcon ? icons[titleIcon] : null;
  const isTitleEditable = Boolean(onTitleRename) && Boolean(title);

  const { isEditing, startEditing, inputProps } = useInlineRename({
    value: title ?? "",
    onSubmit: (newTitle) => onTitleRename?.(newTitle),
  });

  return (
    <header className="bg-background flex h-16 items-center justify-between gap-4 px-4">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {!maintenanceMode && onToggleSidebar && (
          <SidebarToggleButton
            isSidebarOpen={isSidebarOpen}
            onPress={onToggleSidebar}
          />
        )}
        {title && (
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 overflow-hidden",
              isTitleEditable &&
                "group/title hover:bg-muted focus-within:bg-muted -mx-2 rounded-md px-2 transition-colors",
            )}
            onDoubleClick={
              isTitleEditable
                ? (event) => {
                    event.stopPropagation();
                    startEditing();
                  }
                : undefined
            }
          >
            {TitleIcon && <TitleIcon className="size-4 shrink-0" />}
            {isEditing ? (
              <input
                {...inputProps}
                aria-label="Rename title"
                data-testid="app-header-title-input"
                className="max-w-full min-w-0 shrink border-b border-dashed border-current bg-transparent text-sm font-medium outline-none!"
                size={Math.max(inputProps.value.length, 1)}
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                autoFocus
              />
            ) : (
              <>
                <AppNameText
                  appName={title}
                  className="overflow-hidden text-ellipsis whitespace-nowrap"
                />
                {isTitleEditable && (
                  <Tooltip
                    title="Rename"
                    trigger={
                      <IconButton
                        icon="edit"
                        size="sm"
                        variant="ghost"
                        aria-label="Rename"
                        className="opacity-0 transition-opacity group-focus-within/title:opacity-100 group-hover/title:opacity-100"
                        onPress={startEditing}
                      />
                    }
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
      <ColorSchemeSwitch />
    </header>
  );
};
