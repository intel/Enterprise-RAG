// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { AlertDialog } from "@intel-enterprise-rag-ui/components";

export type OnDeleteChatHandler = (chatId: string) => void;

interface DeleteChatDialogProps {
  chatId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onDelete: OnDeleteChatHandler;
}

export const DeleteChatDialog = ({
  chatId,
  isOpen,
  onOpenChange,
  onDelete,
}: DeleteChatDialogProps) => {
  const handleDeleteConfirm = () => {
    onDelete(chatId);
  };

  return (
    <AlertDialog
      title="Delete Chat"
      confirmLabel="Delete"
      confirmVariant="destructive"
      isOpen={isOpen}
      onConfirm={handleDeleteConfirm}
      onOpenChange={onOpenChange}
    >
      <p className="text-xs">
        Are you sure you want to delete this chat?
        <br /> This action cannot be undone.
      </p>
    </AlertDialog>
  );
};
