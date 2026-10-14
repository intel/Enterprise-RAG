// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Button, Dialog, DialogRef } from "@intel-enterprise-rag-ui/components";
import { useRef } from "react";

interface BatchDeleteDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Type of items being deleted */
  itemType: "files" | "links";
  /** Names of items to be deleted */
  itemNames: string[];
  /** Callback when confirm is clicked */
  onConfirm: () => void;
  /** Callback when dialog is closed */
  onClose: () => void;
}

const BatchDeleteDialog = ({
  isOpen,
  itemType,
  itemNames,
  onConfirm,
  onClose,
}: BatchDeleteDialogProps) => {
  const dialogRef = useRef<DialogRef>(null);

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog
      ref={dialogRef}
      data-testid="batch-delete-dialog"
      title="Confirm Delete"
      maxWidth={500}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button
            data-testid="batch-delete-confirm-button"
            size="sm"
            variant="destructive"
            onPress={handleConfirm}
          >
            Confirm
          </Button>
          <Button
            data-testid="batch-delete-cancel-button"
            size="sm"
            variant="outline"
            onPress={onClose}
          >
            Cancel
          </Button>
        </div>
      }
      isOpen={isOpen}
      isCentered
    >
      <div className="flex flex-col gap-4">
        <p className="text-foreground text-sm">
          Are you sure you want to delete the following {itemType}?
        </p>
        {itemNames.length > 0 && (
          <ul className="mb-4 max-h-52 overflow-y-auto pl-5">
            {itemNames.map((name, index) => (
              <li
                key={index}
                className="text-foreground list-disc py-0.5 text-xs break-all"
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
};

export default BatchDeleteDialog;
