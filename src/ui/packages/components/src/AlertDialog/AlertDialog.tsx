// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { useRef, useState } from "react";

import { Button, ButtonVariant } from "@/Button/Button";
import { Dialog, DialogProps, DialogRef } from "@/Dialog/Dialog";

interface AlertDialogProps extends Omit<
  DialogProps,
  "footer" | "isCentered" | "preventClose"
> {
  /** Label for the confirm button */
  confirmLabel?: string;
  /** Label for the cancel button */
  cancelLabel?: string;
  /** Variant of the confirm button */
  confirmVariant?: ButtonVariant;
  /** If true, disables the confirm button */
  isConfirmDisabled?: boolean;
  /** Callback for confirm action. If it returns a Promise, the confirm button shows a spinner
   * and every dismissal path (close button, backdrop, Escape, Cancel) is blocked until it settles. */
  onConfirm: () => void | Promise<void>;
  /** Callback for cancel action */
  onCancel?: () => void;
}

/**
 * Alert dialog component for confirmation dialogs with customizable labels, variants, and actions.
 */
export const AlertDialog = ({
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "default",
  isConfirmDisabled,
  onConfirm,
  onCancel,
  title,
  maxWidth = 400,
  children,
  ...rest
}: AlertDialogProps) => {
  const dialogRef = useRef<DialogRef>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleClose = () => {
    dialogRef.current?.close();
  };

  const handleConfirm = async () => {
    const result = onConfirm();
    if (result instanceof Promise) {
      setIsConfirming(true);
      try {
        await result;
      } finally {
        setIsConfirming(false);
      }
    }
    handleClose();
  };

  return (
    <Dialog
      ref={dialogRef}
      title={title}
      maxWidth={maxWidth}
      onClose={onCancel}
      preventClose={isConfirming}
      isCentered
      {...rest}
    >
      <div className="action-dialog">
        {children}
        <div className="mt-4 flex justify-end gap-2">
          <Button
            size="sm"
            variant={confirmVariant}
            isDisabled={isConfirmDisabled}
            isLoading={isConfirming}
            onPress={handleConfirm}
          >
            {confirmLabel}
          </Button>
          <Button
            size="sm"
            variant="outline"
            isDisabled={isConfirming}
            onPress={handleClose}
          >
            {cancelLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
