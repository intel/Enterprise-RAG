// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./PromptInput.css";

import { IconButton } from "@intel-enterprise-rag-ui/components";
import { sanitizeString } from "@intel-enterprise-rag-ui/utils";
import classNames from "classnames";
import {
  ChangeEvent,
  ChangeEventHandler,
  FormEventHandler,
  KeyboardEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const MAX_REQUEST_BODY_SIZE = 1 * 1024 * 1024; // 1MB in bytes - restriction from nginx config
const REQUEST_BODY_FORMAT_OVERHEAD = '{ "text": "" }'.length;
const PROMPT_MAX_LENGTH = MAX_REQUEST_BODY_SIZE - REQUEST_BODY_FORMAT_OVERHEAD;

interface PromptInputProps {
  prompt: string;
  isChatResponsePending?: boolean;
  enableMicrophone?: boolean;
  /** Focal glow pulse drawing attention to the input — only meaningful on the initial (empty) chat
   * view, before a conversation exists; the parent unmounts this component once the first prompt is
   * sent, which is what actually stops the animation for good. */
  showSparkAnimation?: boolean;
  onRequestAbort?: () => void;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  onSubmit: (prompt: string) => void;
  onSpeechToText?: (audioBlob: Blob) => Promise<string>;
  onSpeechToTextError?: (error: Error) => void;
}

export const PromptInput = ({
  prompt,
  isChatResponsePending = false,
  enableMicrophone = false,
  showSparkAnimation = false,
  onRequestAbort,
  onChange,
  onSubmit,
  onSpeechToText,
  onSpeechToTextError,
}: PromptInputProps) => {
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const isMediaRecorderSupported =
    typeof MediaRecorder !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function";

  useEffect(() => {
    focusPromptInput();
  }, []);

  useEffect(() => {
    return () => {
      stopMediaStream();
    };
  }, []);

  const stopMediaStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  };

  const focusPromptInput = () => {
    promptInputRef.current!.focus();
  };

  const hasText = prompt.trim().length > 0;

  const isSubmitDisabled = useCallback(() => {
    const sanitizedPrompt = sanitizeString(prompt).trim();
    const isPromptEmpty = sanitizedPrompt.length === 0;
    const isPromptMaxLengthExceeded =
      sanitizedPrompt.length > PROMPT_MAX_LENGTH;

    return isPromptEmpty || isPromptMaxLengthExceeded;
  }, [prompt]);

  const submitPrompt = () => {
    const sanitizedPrompt = sanitizeString(prompt).trim();
    onSubmit(sanitizedPrompt);

    focusPromptInput();
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    submitPrompt();
  };

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isSubmitDisabled() && !isChatResponsePending) {
        submitPrompt();
      }
    }
  };

  const handleStopBtnPress = () => {
    onRequestAbort?.();
    focusPromptInput();
  };

  const appendTranscriptToInput = (transcript: string) => {
    if (transcript && transcript !== "[BLANK_AUDIO]") {
      const separator = prompt.length > 0 ? " " : "";
      const syntheticEvent = {
        target: {
          value: `${prompt}${separator}${transcript}`,
        },
      } as ChangeEvent<HTMLTextAreaElement>;
      onChange(syntheticEvent);
    }
  };

  const startRecording = async () => {
    if (!onSpeechToText) {
      console.error(
        "onSpeechToText callback is required for microphone functionality",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        stopMediaStream();

        if (audioBlob.size > 0 && onSpeechToText) {
          try {
            const transcript = await onSpeechToText(audioBlob);
            appendTranscriptToInput(transcript.trim());
          } catch (error) {
            console.error("Speech-to-text transcription failed:", error);
            onSpeechToTextError?.(
              error instanceof Error
                ? error
                : new Error("Transcription failed"),
            );
          } finally {
            setIsTranscribing(false);
            focusPromptInput();
          }
        } else {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.onerror = () => {
        setIsRecording(false);
        stopMediaStream();
        onSpeechToTextError?.(new Error("Recording failed"));
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      onSpeechToTextError?.(
        error instanceof Error
          ? error
          : new Error("Failed to access microphone"),
      );
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      setIsTranscribing(true);
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleMicrophoneBtnPress = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Mirrors packages/shadcn-preset's PromptInput: at most one trailing action
  // button is shown at a time (stop > microphone > send), not stacked side by
  // side — an empty textarea shows the microphone instead of a disabled send
  // button, and send takes over as soon as there's text to submit.
  const showStopButton = Boolean(onRequestAbort && isChatResponsePending);
  const showMicrophoneButton =
    !showStopButton &&
    !hasText &&
    enableMicrophone &&
    isMediaRecorderSupported &&
    Boolean(onSpeechToText);
  const showSendButton = !showStopButton && !showMicrophoneButton;

  const isMicrophoneButtonDisabled =
    (isChatResponsePending && !isRecording) || isTranscribing;

  const microphoneButtonIcon = useMemo(
    () => (isRecording ? "microphone-recording" : "microphone"),
    [isRecording],
  );

  const microphoneButtonAriaLabel = useMemo(
    () => (isRecording ? "Stop recording" : "Start recording"),
    [isRecording],
  );

  return (
    <form
      className={classNames(
        "border-input bg-card focus-within:border-ring focus-within:ring-ring/30 z-10 mx-4 flex w-[calc(100%_-_2rem)] max-w-full items-end gap-2 rounded-md border p-2 focus-within:ring-2 md:mx-auto md:w-[46rem]",
        {
          "prompt-input__form--spark": showSparkAnimation,
        },
      )}
      onSubmit={handleSubmit}
      data-testid="prompt-input-form"
    >
      <textarea
        ref={promptInputRef}
        aria-label="Your message"
        value={prompt}
        name="prompt-input"
        placeholder="Enter your prompt..."
        maxLength={PROMPT_MAX_LENGTH}
        rows={1}
        className="placeholder:text-muted-foreground field-sizing-content max-h-60 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-1 text-sm/relaxed outline-none! placeholder:not-italic"
        data-testid="prompt-input-textarea"
        onChange={onChange}
        onKeyDown={handleKeyDown}
      />
      {showStopButton && (
        <IconButton
          data-testid="prompt-stop-button"
          icon="prompt-stop"
          type="button"
          variant="outline"
          size="lg"
          aria-label="Stop response"
          onPress={handleStopBtnPress}
        />
      )}
      {showMicrophoneButton && (
        <IconButton
          data-testid="prompt-microphone-button"
          icon={microphoneButtonIcon}
          type="button"
          variant={isRecording ? "destructive" : "default"}
          size="lg"
          aria-label={microphoneButtonAriaLabel}
          aria-pressed={isRecording}
          isDisabled={isMicrophoneButtonDisabled}
          onPress={handleMicrophoneBtnPress}
        />
      )}
      {showSendButton && (
        <IconButton
          data-testid="prompt-send-button"
          icon="prompt-send"
          type="submit"
          variant="default"
          size="lg"
          aria-label="Send prompt"
          isDisabled={isSubmitDisabled()}
        />
      )}
    </form>
  );
};
