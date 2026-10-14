import {
  MicrophoneIcon,
  PaperPlaneRightIcon,
  StopIcon,
} from "@phosphor-icons/react";
import { cn } from "cn";
import * as React from "react";

import { Button } from "@/components/ui/button";

interface PromptInputProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  isPending?: boolean;
  onAbort?: () => void;
  placeholder?: string;
  className?: string;
  // When provided, an empty textarea shows a microphone button instead of the (disabled)
  // send button — send only takes over once there's text to submit.
  onMicClick?: () => void;
  isRecording?: boolean;
}

function PromptInput({
  value,
  onValueChange,
  onSubmit,
  isPending = false,
  onAbort,
  placeholder = "Enter your prompt...",
  className,
  onMicClick,
  isRecording = false,
}: PromptInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const hasText = value.trim().length > 0;

  const submit = () => {
    if (!hasText || isPending) return;
    onSubmit(value.trim());
  };

  return (
    <form
      data-slot="prompt-input"
      className={cn(
        "border-input bg-input/20 focus-within:ring-ring/30 flex items-end gap-2 rounded-md border p-2 focus-within:ring-2",
        className,
      )}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        rows={1}
        placeholder={placeholder}
        aria-label="Your message"
        // items-end keeps the send button pinned to the bottom as the textarea grows past
        // one line. This py matches a single line's own box height to the button's (size-8,
        // 32px) so the 1-line case still looks vertically centered against it.
        className="placeholder:text-muted-foreground field-sizing-content max-h-60 flex-1 resize-none bg-transparent px-1 py-1 text-sm/relaxed outline-none"
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      {isPending && onAbort ? (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Stop response"
          onClick={onAbort}
        >
          <StopIcon />
        </Button>
      ) : !hasText && onMicClick ? (
        <Button
          type="button"
          variant={isRecording ? "destructive" : "default"}
          size="icon-sm"
          aria-label={isRecording ? "Stop recording" : "Start recording"}
          aria-pressed={isRecording}
          onClick={onMicClick}
        >
          <MicrophoneIcon weight={isRecording ? "fill" : "regular"} />
        </Button>
      ) : (
        <Button
          type="submit"
          size="icon-sm"
          aria-label="Send prompt"
          disabled={!hasText}
        >
          <PaperPlaneRightIcon />
        </Button>
      )}
    </form>
  );
}

export { PromptInput };
