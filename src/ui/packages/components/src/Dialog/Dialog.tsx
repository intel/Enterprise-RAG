// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@intel-enterprise-rag-ui/utils";
import {
  forwardRef,
  PropsWithChildren,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { IconButton } from "@/IconButton/IconButton";

export interface DialogRef {
  close: () => void;
}

export interface DialogProps extends PropsWithChildren {
  /** Title of the dialog */
  title: string;
  /** Element that triggers the dialog */
  trigger?: JSX.Element;
  /** Footer content for the dialog */
  footer?: ReactNode;
  /** If true, dialog is open */
  isOpen?: boolean;
  /** If true, dialog is centered */
  isCentered?: boolean;
  /** Maximum width of the dialog */
  maxWidth?: number;
  /** Callback when dialog is closed */
  onClose?: () => void;
  /** Callback when open state changes */
  onOpenChange?: (isOpen: boolean) => void;
  /** If true, blocks every dismissal path — backdrop click, Escape, and the close button */
  preventClose?: boolean;
  /** Additional props for testing purposes */
  "data-testid"?: string;
}

/**
 * Dialog component for displaying modal dialogs with customizable title, footer, and content.
 */
export const Dialog = forwardRef<DialogRef, DialogProps>(
  (
    {
      title,
      isOpen,
      trigger,
      footer,
      maxWidth,
      isCentered,
      onClose,
      onOpenChange,
      preventClose,
      children,
      "data-testid": dataTestId = "dialog",
    }: DialogProps,
    forwardedRef,
  ) => {
    const [open, setOpen] = useState(isOpen ?? false);
    const headingId = useId();
    // Re-entrancy guard: consumers commonly call `dialogRef.close()` from inside
    // their own `onClose` handler (to reset local state on any dismissal path).
    // Without this, that call re-enters handleOpenChange(false) and calls onClose
    // again, recursing until the call stack overflows.
    const isClosingRef = useRef(false);

    useEffect(() => {
      if (isOpen !== undefined) {
        setOpen(isOpen);
      }
    }, [isOpen]);

    const handleOpenChange = useCallback(
      (next: boolean) => {
        if (!next && preventClose) {
          return;
        }
        setOpen(next);
        onOpenChange?.(next);
        if (!next && !isClosingRef.current) {
          isClosingRef.current = true;
          onClose?.();
          isClosingRef.current = false;
        }
      },
      [preventClose, onOpenChange, onClose],
    );

    useImperativeHandle(
      forwardedRef,
      () => ({
        close: () => handleOpenChange(false),
      }),
      [handleOpenChange],
    );

    return (
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        {trigger && <DialogPrimitive.Trigger render={trigger} />}
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-[99] bg-black/75" />
          <DialogPrimitive.Popup
            data-testid={dataTestId}
            aria-labelledby={headingId}
            className={cn(
              "fixed top-0 z-[100] flex h-screen w-full items-start justify-center overflow-hidden bg-transparent p-4",
              isCentered && "items-center",
            )}
          >
            <div
              className="bg-background text-foreground ring-foreground/10 relative w-full rounded-xl ring-1"
              style={{ maxWidth }}
            >
              <div className="flex flex-col gap-4 p-4">
                <DialogPrimitive.Title
                  id={headingId}
                  className="pr-8 text-sm font-medium"
                >
                  {title}
                </DialogPrimitive.Title>
                <section
                  className="max-h-[calc(100vh-9.5rem)] overflow-y-auto"
                  data-testid={trigger ? `${dataTestId}-content` : undefined}
                >
                  {children}
                </section>
                {footer && (
                  <footer
                    className="flex w-full items-center justify-end gap-2"
                    data-testid={trigger ? `${dataTestId}-footer` : undefined}
                  >
                    {footer}
                  </footer>
                )}
              </div>
              <IconButton
                data-testid={trigger ? `${dataTestId}-close-button` : undefined}
                icon="close"
                aria-label="Close dialog"
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                isDisabled={preventClose}
                onPress={() => handleOpenChange(false)}
              />
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  },
);

Dialog.displayName = "Dialog";
