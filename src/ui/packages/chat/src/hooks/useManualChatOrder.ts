// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useState } from "react";

const CHAT_ORDER_STORAGE_KEY = "chatManualOrder";

type OrderMap = Record<string, number>;

const getOrderFromStorage = (): OrderMap => {
  try {
    const stored = localStorage.getItem(CHAT_ORDER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const setOrderToStorage = (order: OrderMap): void => {
  localStorage.setItem(CHAT_ORDER_STORAGE_KEY, JSON.stringify(order));
};

/**
 * Persists a user-dragged order for unpinned chat list items, which are otherwise always re-sorted
 * by `createdAt` (see groupByTime.ts) — items the user hasn't dragged keep sorting by date; a
 * dragged item's stored index always ranks before any un-dragged item in the same time group.
 */
export const useManualChatOrder = () => {
  const [order, setOrder] = useState<OrderMap>(getOrderFromStorage);

  const getOrderIndex = useCallback(
    (id: string): number | undefined => order[id],
    [order],
  );

  const setManualOrder = useCallback((orderedIds: string[]): void => {
    setOrder((prev) => {
      const next = { ...prev };
      orderedIds.forEach((id, index) => {
        next[id] = index;
      });
      setOrderToStorage(next);
      return next;
    });
  }, []);

  return { getOrderIndex, setManualOrder };
};
