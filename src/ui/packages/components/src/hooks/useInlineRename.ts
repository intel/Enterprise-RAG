// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  ChangeEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export interface UseInlineRenameOptions {
  /** Current committed value shown when not editing */
  value: string;
  /** Called with the trimmed value once the user commits a change */
  onSubmit: (newValue: string) => void;
  /** Maximum number of characters allowed while editing */
  maxLength?: number;
}

/**
 * Shared double-click-to-rename behavior for the app header title and chat history list items —
 * owns edit-mode state/draft text so each caller only has to render its own markup.
 */
export const useInlineRename = ({
  value,
  onSubmit,
  maxLength,
}: UseInlineRenameOptions) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const startEditing = useCallback(() => {
    setDraft(value);
    setIsEditing(true);
  }, [value]);

  const commit = useCallback(() => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSubmit(trimmed);
    }
  }, [draft, value, onSubmit]);

  const cancel = useCallback(() => {
    setDraft(value);
    setIsEditing(false);
  }, [value]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setDraft(maxLength ? nextValue.slice(0, maxLength) : nextValue);
    },
    [maxLength],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    },
    [commit, cancel],
  );

  return {
    isEditing,
    startEditing,
    inputProps: {
      ref: inputRef,
      value: draft,
      maxLength,
      onChange: handleChange,
      onKeyDown: handleKeyDown,
      onBlur: commit,
    },
  };
};
