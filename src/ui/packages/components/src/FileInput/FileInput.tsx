// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { FileIcon } from "@intel-enterprise-rag-ui/icons";
import { cn } from "@intel-enterprise-rag-ui/utils";
import {
  DragEvent,
  forwardRef,
  Fragment,
  InputHTMLAttributes,
  useCallback,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { Alert, AlertDescription } from "@/Alert/Alert";
import { Button } from "@/Button/Button";

export interface FileInputHandle {
  clear: () => void;
  click: () => void;
}

interface FileInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /* Array of supported file extensions. If defined, a proper message will be displayed.  */
  supportedFileExtensions?: string[];
  /* A limit of upload in MB. If defined, a proper message will be displayed. */
  totalSizeLimit?: number;
  /* Error message to be displayed. */
  errorMessage?: string;
}

export const FileInput = forwardRef<FileInputHandle, FileInputProps>(
  (
    {
      errorMessage,
      totalSizeLimit,
      supportedFileExtensions,
      multiple = false,
      onDrop,
      onChange,
      className,
      ...rest
    }: FileInputProps,
    forwardedRef,
  ) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const errorMessageId = `${useId()}-file-input-error`;
    useImperativeHandle(forwardedRef, () => ({
      clear: () => {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      },
      click: () => {
        fileInputRef.current?.click();
      },
    }));

    const [isDragOver, setIsDragOver] = useState(false);

    const handleFileInputDragOver = useCallback((event: DragEvent) => {
      event.preventDefault();
      setIsDragOver(true);
    }, []);

    const handleFileInputDragLeave = useCallback(() => {
      setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(
      (event: DragEvent<HTMLInputElement>) => {
        setIsDragOver(false);
        onDrop?.(event);
      },
      [onDrop],
    );

    const handleBrowseFilesButtonPress = useCallback(() => {
      fileInputRef.current!.click();
    }, []);

    const fileInputBoxClassNames = cn(
      "bg-secondary border-input flex h-48 w-full flex-col items-center justify-center gap-2.5 rounded border border-dashed p-6 text-center select-none",
      isDragOver && "bg-secondary/50",
    );

    const fileInputAccept = useMemo(
      () =>
        supportedFileExtensions
          ? supportedFileExtensions
              .map((extension) => `.${extension}`)
              .join(",")
          : undefined,
      [supportedFileExtensions],
    );

    const supportedFileFormatsMsg = useMemo(
      () =>
        supportedFileExtensions
          ? `Supported file formats:  ${supportedFileExtensions
              .map((extension) => extension.toUpperCase())
              .join(", ")}`
          : "",
      [supportedFileExtensions],
    );

    const hasErrorMessage = useMemo(
      () => errorMessage && errorMessage !== "",
      [errorMessage],
    );

    const ariaLabel = useMemo(() => {
      if (rest["aria-label"]) {
        return rest["aria-label"];
      }
      if (multiple) {
        return "File Input, multiple files enabled";
      }
      return "File Input";
    }, [multiple, rest]);

    return (
      <div className={className}>
        <div
          className={fileInputBoxClassNames}
          onDragOver={handleFileInputDragOver}
          onDragLeave={handleFileInputDragLeave}
          onDrop={handleDrop}
        >
          {!isDragOver && (
            <>
              <FileIcon fontSize={20} />
              <p>Drag and Drop File{multiple && "s"}</p>
              <p className="text-xs">or</p>
              <Button
                data-testid="browse-files-button"
                size="sm"
                onPress={handleBrowseFilesButtonPress}
              >
                Browse Files
              </Button>
              {totalSizeLimit && (
                <p className="text-xs">{`Single upload size limit: ${totalSizeLimit}MB`}</p>
              )}
            </>
          )}
          {isDragOver && <p>Drop Here</p>}
          <input
            {...rest}
            ref={fileInputRef}
            type="file"
            accept={fileInputAccept}
            className="hidden"
            multiple={multiple}
            aria-label={ariaLabel}
            aria-describedby={hasErrorMessage ? errorMessageId : undefined}
            onChange={onChange}
            data-testid="file-input"
          />
        </div>
        {hasErrorMessage && (
          <Alert
            variant="error"
            id={errorMessageId}
            className="-mt-2 rounded-t-none text-center"
          >
            <AlertDescription>
              {(errorMessage ?? "").split("\n").map((msg, index) => (
                <Fragment key={`file-input-error-msg-${index}`}>
                  {msg}
                  <br />
                </Fragment>
              ))}
            </AlertDescription>
          </Alert>
        )}
        {supportedFileFormatsMsg && (
          <p className="pt-2 text-xs">{supportedFileFormatsMsg}</p>
        )}
      </div>
    );
  },
);

FileInput.displayName = "FileInput";
