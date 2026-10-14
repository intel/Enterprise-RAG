import { UploadSimpleIcon } from "@phosphor-icons/react";
import { cn } from "cn";
import * as React from "react";

import { Button } from "@/components/ui/button";

export interface FileInputHandle {
  clear: () => void;
  click: () => void;
}

interface FileInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  supportedFileExtensions?: string[];
  totalSizeLimit?: number;
  errorMessage?: string;
}

const FileInput = React.forwardRef<FileInputHandle, FileInputProps>(
  function FileInput(
    {
      className,
      multiple = false,
      supportedFileExtensions,
      totalSizeLimit,
      errorMessage,
      onDrop,
      ...props
    },
    forwardedRef,
  ) {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const [isDragOver, setIsDragOver] = React.useState(false);

    React.useImperativeHandle(forwardedRef, () => ({
      clear: () => {
        if (inputRef.current) inputRef.current.value = "";
      },
      click: () => inputRef.current?.click(),
    }));

    const accept = supportedFileExtensions
      ?.map((extension) => `.${extension}`)
      .join(",");

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <div
          data-slot="file-input"
          data-drag-over={isDragOver || undefined}
          className="border-input data-[drag-over]:bg-input/15 data-[drag-over]:border-ring flex flex-col items-center gap-1.5 rounded-md border border-dashed px-4 py-6 text-center transition-colors"
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(event) => {
            setIsDragOver(false);
            onDrop?.(event);
          }}
        >
          {isDragOver ? (
            <p className="text-sm">Drop here</p>
          ) : (
            <>
              <UploadSimpleIcon className="text-muted-foreground size-5" />
              {/* Font-size hierarchy: the instruction (what to do) is the most prominent
                  text here, "or" is a minor divider, and the size limit is secondary
                  supporting info — the Browse button itself carries the primary action. */}
              <p className="text-sm">Drag and drop file{multiple && "s"}</p>
              <p className="text-muted-foreground text-xs">or</p>
              <Button
                type="button"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                Browse files
              </Button>
              {totalSizeLimit && (
                <p className="text-muted-foreground text-xs">
                  Single upload size limit: {totalSizeLimit}MB
                </p>
              )}
            </>
          )}
          <input
            {...props}
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className="hidden"
          />
        </div>
        {errorMessage && (
          <p className="text-destructive text-sm font-medium">{errorMessage}</p>
        )}
        {supportedFileExtensions && (
          <p className="text-muted-foreground text-xs">
            Supported file formats:{" "}
            {supportedFileExtensions.map((ext) => ext.toUpperCase()).join(", ")}
          </p>
        )}
      </div>
    );
  },
);

export { FileInput };
