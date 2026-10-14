// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Button, Label, Textarea } from "@intel-enterprise-rag-ui/components";
import { getValidationErrorMessage } from "@intel-enterprise-rag-ui/input-validation";
import { ChangeEventHandler, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { useSummarizePlainTextMutation } from "@/features/docsum/api";
import { SummaryType } from "@/features/docsum/api/types";
import GeneratedSummary from "@/features/docsum/components/shared/GeneratedSummary/GeneratedSummary";
import GenerateSummaryDropdownButton from "@/features/docsum/components/shared/GenerateSummaryDropdownButton/GenerateSummaryDropdownButton";
import { addHistoryItem } from "@/features/docsum/store/history.slice";
import {
  clearPasteTextTab,
  selectPasteTextTabState,
  setErrorMessage,
  setIsInvalid,
  setIsLoading,
  setStreamingText,
  setSummary,
  setSummaryType,
  setText,
} from "@/features/docsum/store/pasteTextTab.slice";
import { validateTextAreaInput } from "@/features/docsum/validators/textAreaInput";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { shortenText } from "@/utils/text";

const PasteTextTab = () => {
  const [summarizePlainText, { data }] = useSummarizePlainTextMutation();

  const dispatch = useAppDispatch();
  const {
    text,
    summary,
    streamingText,
    isLoading,
    errorMessage,
    isInvalid,
    summaryType,
  } = useAppSelector(selectPasteTextTabState);

  const summaryRef = useRef("");

  useEffect(() => {
    const checkValidity = async (text: string) => {
      try {
        await validateTextAreaInput(text);
        dispatch(setIsInvalid(false));
        dispatch(setErrorMessage(""));
      } catch (error) {
        dispatch(setIsInvalid(true));
        dispatch(setErrorMessage(getValidationErrorMessage(error)));
      }
    };

    if (text) {
      checkValidity(text);
    } else {
      dispatch(setIsInvalid(false));
      dispatch(setErrorMessage(""));
    }
  }, [text, dispatch]);

  const focusTextArea = () => {
    const textArea = document.querySelector("textarea[name='paste-text']");
    if (textArea instanceof HTMLTextAreaElement) {
      textArea.focus();
    }
  };

  const clearText = () => {
    dispatch(clearPasteTextTab());
    summaryRef.current = "";
    focusTextArea();
  };

  const handleChange: ChangeEventHandler<HTMLTextAreaElement> = (event) => {
    dispatch(setText(event.target.value));
  };

  const handleGenerateSummaryButtonPress = useCallback(async () => {
    if (text.trim()) {
      summaryRef.current = "";
      dispatch(setSummary(""));
      dispatch(setStreamingText(""));
      dispatch(setIsLoading(true));

      const handleUpdate = (chunk: string) => {
        summaryRef.current += chunk;
        dispatch(setStreamingText(summaryRef.current));
      };

      const { data, error } = await summarizePlainText({
        text,
        summaryType,
        onSummaryUpdate: handleUpdate,
      });

      dispatch(setIsLoading(false));

      if (error) {
        console.error("Text summary error:", error);
        toast.error(`An error occurred while summarizing the text: ${error}`);
      } else {
        const summaryToSave = summaryRef.current ?? data?.text ?? "";
        if (summaryToSave) {
          summaryRef.current = summaryToSave;
          dispatch(setSummary(summaryToSave));
          dispatch(
            addHistoryItem({
              title: shortenText(text),
              sourceType: "plainText",
              summary: summaryToSave,
              source: text,
            }),
          );
          toast.success(
            "The summary for the pasted text has been saved successfully.",
          );
        }
      }
      dispatch(setStreamingText(""));
    }
  }, [text, summaryType, summarizePlainText, dispatch]);

  const handleSummaryTypeChange = (value: SummaryType) => {
    dispatch(setSummaryType(value));
  };

  const isGeneratingSummaryDisabled = !text.trim() || isLoading;
  const isClearBtnDisabled =
    text.trim().length === 0 || isGeneratingSummaryDisabled;

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-2 gap-8 px-16 pt-6 pb-16">
      <div className="flex h-full flex-col">
        <div className="mb-2 flex flex-row items-center justify-between">
          <Label htmlFor="paste-text" className="font-medium">
            Text to Summarize
          </Label>
          <Button
            data-testid="paste-text-clear-button"
            size="sm"
            variant="outline"
            isDisabled={isClearBtnDisabled}
            onPress={clearText}
          >
            Clear
          </Button>
        </div>
        <Textarea
          data-testid="paste-text-textarea-input"
          id="paste-text"
          name="paste-text"
          value={text}
          placeholder="Paste your text here..."
          className="h-[calc(100vh-20.5rem)]"
          aria-label="Paste your text here"
          aria-describedby="paste-text-error-message"
          disabled={isLoading}
          onChange={handleChange}
          isInvalid={isInvalid}
        />
        <p
          id="paste-text-error-message"
          aria-live="polite"
          className="text-destructive mt-2 h-4 text-sm"
        >
          {errorMessage}
        </p>
        <GenerateSummaryDropdownButton
          summaryType={summaryType}
          onSummaryTypeChange={handleSummaryTypeChange}
          onGenerateSummary={handleGenerateSummaryButtonPress}
          isDisabled={isGeneratingSummaryDisabled}
          className="mt-4"
        />
      </div>
      <div className="h-full min-h-0 flex-1 overflow-y-auto">
        <GeneratedSummary
          summary={summary}
          isLoading={isLoading}
          fileName={shortenText(text)}
          data={data}
          streamingText={streamingText}
        />
      </div>
    </div>
  );
};

export default PasteTextTab;
