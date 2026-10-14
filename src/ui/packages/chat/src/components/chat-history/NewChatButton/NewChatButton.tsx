// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { SidebarMenuItem } from "@intel-enterprise-rag-ui/layouts";

interface NewChatButtonProps {
  onPress: () => void;
}

export const NewChatButton = ({ onPress }: NewChatButtonProps) => (
  <SidebarMenuItem
    data-testid="new-chat-button"
    icon="new-chat"
    label="New Chat"
    onPress={onPress}
  />
);
