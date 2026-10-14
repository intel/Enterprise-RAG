// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  LoadingFallback,
  SearchBar,
} from "@intel-enterprise-rag-ui/components";
import { DisclosureIcon } from "@intel-enterprise-rag-ui/icons";
import classNames from "classnames";
import { ReactNode, useMemo, useState } from "react";

import type { OnChatHistoryItemPressHandler } from "@/components/chat-history/ChatHistoryItem/ChatHistoryItem";
import { ChatHistoryItem } from "@/components/chat-history/ChatHistoryItem/ChatHistoryItem";
import type { OnDeleteChatHandler } from "@/components/chat-history/DeleteChatDialog/DeleteChatDialog";
import type { OnExportChatHandler } from "@/components/chat-history/ExportChatDialog/ExportChatDialog";
import type { OnRenameChatHandler } from "@/components/chat-history/RenameChatDialog/RenameChatDialog";
import { SortableChatHistoryItem } from "@/components/chat-history/SortableChatHistoryItem/SortableChatHistoryItem";
import { useManualChatOrder } from "@/hooks/useManualChatOrder";
import { usePinnedChats } from "@/hooks/usePinnedChats";
import { ChatHistoryItemData } from "@/types";
import { groupChatsByTime } from "@/utils/groupByTime";

interface SortableChatItemsProps {
  items: ChatHistoryItemData[];
  onReorder: (newOrderIds: string[]) => void;
  renderItem: (item: ChatHistoryItemData) => ReactNode;
}

/** y-axis-only drag reordering, clamped to the sidebar's own width via `restrictToParentElement`. */
const SortableChatItems = ({
  items,
  onReorder,
  renderItem,
}: SortableChatItemsProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const ids = useMemo(() => items.map((item) => item.id), [items]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <SortableChatHistoryItem key={item.id} id={item.id}>
              {renderItem(item)}
            </SortableChatHistoryItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export type IsItemActiveHandler = (id: string) => boolean;

interface ChatHistoryListProps {
  data?: ChatHistoryItemData[];
  isLoading: boolean;
  onItemPress: OnChatHistoryItemPressHandler;
  isItemActive: IsItemActiveHandler;
  onDelete: OnDeleteChatHandler;
  onExport: OnExportChatHandler;
  onRename: OnRenameChatHandler;
}

export const ChatHistoryList = ({
  data,
  isLoading,
  onItemPress,
  isItemActive,
  onDelete,
  onExport,
  onRename,
}: ChatHistoryListProps) => {
  const [searchFilter, setSearchFilter] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const { pinnedIds, isPinned, togglePinChat, reorderPinnedChats } =
    usePinnedChats();
  const { getOrderIndex, setManualOrder } = useManualChatOrder();

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const filteredData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    if (!searchFilter.trim()) return data;

    const lowerSearchFilter = searchFilter.toLowerCase();
    return data.filter((item) =>
      item.name.toLowerCase().includes(lowerSearchFilter),
    );
  }, [data, searchFilter]);

  const isChatHistoryEmpty = filteredData.length === 0;

  const emptyStateMessage = searchFilter.trim()
    ? "No chat history matches your search."
    : "No chat history available.";

  const chatHistoryListClass = classNames(
    "flex max-h-[calc(100vh_-_10rem)] [scrollbar-gutter:stable] flex-col overflow-y-auto",
    {
      "h-32 items-center justify-center": isChatHistoryEmpty,
    },
  );

  const { pinnedChats, groupedUnpinnedChats } = useMemo(() => {
    const pinned: ChatHistoryItemData[] = [];
    const unpinned: ChatHistoryItemData[] = [];

    if (!isLoading && filteredData) {
      const dataMap = new Map(filteredData.map((item) => [item.id, item]));

      pinnedIds.forEach((id) => {
        const item = dataMap.get(id);
        if (item) {
          pinned.push(item);
        }
      });

      filteredData.forEach((item) => {
        if (!pinnedIds.includes(item.id)) {
          unpinned.push(item);
        }
      });
    }

    const groups = groupChatsByTime(unpinned).map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => {
        const orderA = getOrderIndex(a.id);
        const orderB = getOrderIndex(b.id);
        if (orderA !== undefined && orderB !== undefined) {
          return orderA - orderB;
        }
        if (orderA !== undefined) return -1;
        if (orderB !== undefined) return 1;
        return 0;
      }),
    }));

    return {
      pinnedChats: pinned,
      groupedUnpinnedChats: groups,
    };
  }, [isLoading, filteredData, pinnedIds, getOrderIndex]);

  const hasPinnedChats = pinnedChats.length > 0;

  return (
    <aside aria-label="Chat History List">
      <div className="mb-4 flex h-16 items-center">
        <SearchBar
          data-testid="chat-history-search-bar"
          value={searchFilter}
          placeholder="Search chat history..."
          onChange={setSearchFilter}
        />
      </div>
      <div className={chatHistoryListClass}>
        {isLoading && <LoadingFallback />}
        {!isLoading && isChatHistoryEmpty && (
          <p className="text-xs text-gray-500">{emptyStateMessage}</p>
        )}
        {!isLoading && !isChatHistoryEmpty && (
          <>
            {hasPinnedChats && (
              <div className="flex flex-col not-last:mb-4">
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                  Pinned
                </p>
                <SortableChatItems
                  items={pinnedChats}
                  onReorder={reorderPinnedChats}
                  renderItem={(item) => (
                    <ChatHistoryItem
                      itemData={item}
                      pinned={isPinned(item.id)}
                      onPinChange={() => togglePinChat(item.id)}
                      isActive={isItemActive(item.id)}
                      onPress={() => onItemPress(item.id)}
                      onDelete={onDelete}
                      onExport={onExport}
                      onRename={onRename}
                    />
                  )}
                />
              </div>
            )}
            {groupedUnpinnedChats.map((group) => {
              const isExpanded = !collapsedGroups.has(group.label);

              return (
                <div key={group.label} className="flex flex-col not-last:mb-4">
                  <button
                    type="button"
                    className="mb-2 flex w-full cursor-pointer items-center justify-between gap-1 border-none bg-transparent p-0 text-left"
                    aria-expanded={isExpanded}
                    onClick={() => toggleGroup(group.label)}
                  >
                    <span className="text-muted-foreground ml-2 text-xs font-medium normal-case">
                      {group.label}
                    </span>
                    <DisclosureIcon
                      className={classNames(
                        "text-muted-foreground size-3.5 shrink-0 transition-transform duration-150",
                        {
                          "-rotate-90": !isExpanded,
                        },
                      )}
                    />
                  </button>
                  {isExpanded && (
                    <SortableChatItems
                      items={group.items}
                      onReorder={setManualOrder}
                      renderItem={(item) => (
                        <ChatHistoryItem
                          itemData={item}
                          pinned={isPinned(item.id)}
                          onPinChange={() => togglePinChat(item.id)}
                          isActive={isItemActive(item.id)}
                          onPress={() => onItemPress(item.id)}
                          onDelete={onDelete}
                          onExport={onExport}
                          onRename={onRename}
                        />
                      )}
                    />
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </aside>
  );
};
