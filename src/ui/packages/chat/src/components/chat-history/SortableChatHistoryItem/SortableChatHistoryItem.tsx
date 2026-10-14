// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import classNames from "classnames";
import { PropsWithChildren } from "react";

interface SortableChatHistoryItemProps extends PropsWithChildren {
  id: string;
}

/**
 * Drag handle wrapper around a single ChatHistoryItem row — the whole row is the drag surface
 * (dnd-kit's PointerSensor activation distance keeps ordinary clicks/double-clicks working).
 */
export const SortableChatHistoryItem = ({
  id,
  children,
}: SortableChatHistoryItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={classNames("touch-none", {
        "relative z-10 opacity-80": isDragging,
      })}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
};
