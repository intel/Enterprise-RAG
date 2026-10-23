// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./NewChatButton.css";

import { IconButton } from "@/IconButton/IconButton";
import { Tooltip } from "@/Tooltip/Tooltip";

interface NewChatButtonProps {
  onPress: () => void;
}

export const NewChatButton = ({ onPress }: NewChatButtonProps) => (
  <Tooltip
    title="Create new chat"
    trigger={
      <IconButton
        data-testid="new-chat-button"
        icon="new-chat"
        variant="contained"
        className="new-chat-btn"
        onPress={onPress}
      />
    }
    placement="bottom"
  />
);
