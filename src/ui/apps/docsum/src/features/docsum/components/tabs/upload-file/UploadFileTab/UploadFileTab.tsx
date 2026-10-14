// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  FileInput,
  FileInputHandle,
} from "@intel-enterprise-rag-ui/components";
import { getValidationErrorMessage } from "@intel-enterprise-rag-ui/input-validation";
import { sanitizeFile } from "@intel-enterprise-rag-ui/utils";
import { ChangeEvent, DragEvent, useCallback, useRef } from "react";
import { toast } from "sonner";

import { useSummarizeFileMutation } from "@/features/docsum/api";
import { SummaryType } from "@/features/docsum/api/types";
import GeneratedSummary from "@/features/docsum/components/shared/GeneratedSummary/GeneratedSummary";
import GenerateSummaryDropdownButton from "@/features/docsum/components/shared/GenerateSummaryDropdownButton/GenerateSummaryDropdownButton";
import FileSelectedToSummarize from "@/features/docsum/components/tabs/upload-file/FileSelectedToSummarize/FileSelectedToSummarize";
import { addHistoryItem } from "@/features/docsum/store/history.slice";
import {
  clearUploadFileTab,
  selectUploadFileTabState,
  setErrorMessage,
  setFileData,
  setIsLoading,
  setStreamingText,
  setSummary,
  setSummaryType,
} from "@/features/docsum/store/uploadFileTab.slice";
import { validateFileInput } from "@/features/docsum/validators/fileInput";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const SUPPORTED_FILE_EXTENSIONS = ["pdf", "doc", "docx", "md"];

const CLIENT_MAX_BODY_SIZE = 64; // in MB, should be in sync with server configuration

const UploadFileTab = () => {
  const [summarizeFile, { data }] = useSummarizeFileMutation();

  const dispatch = useAppDispatch();
  const {
    fileData,
    summary,
    streamingText,
    isLoading,
    errorMessage,
    summaryType,
  } = useAppSelector(selectUploadFileTabState);

  const fileInputRef = useRef<FileInputHandle>(null);
  const summaryRef = useRef("");

  const processFile = useCallback(
    async (file: File) => {
      const sanitizedFile = sanitizeFile(file);
      try {
        await validateFileInput(sanitizedFile);
        dispatch(setErrorMessage(""));
        dispatch(setFileData(sanitizedFile));
      } catch (error) {
        dispatch(setErrorMessage(getValidationErrorMessage(error)));
      }

      fileInputRef.current?.clear();
    },
    [dispatch],
  );

  const handleFileInputDrop = useCallback(
    async (event: DragEvent) => {
      event.preventDefault();

      const file = event.dataTransfer?.files[0] ?? null;
      if (file !== null) {
        await processFile(file);
      }
    },
    [processFile],
  );

  const handleFileInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files![0] ?? null;
      if (file !== null && file instanceof File) {
        await processFile(file);
      }

      summaryRef.current = "";
      dispatch(setStreamingText(""));
    },
    [processFile, dispatch],
  );

  const isGeneratingSummary = !fileData || isLoading;

  const handleGenerateSummaryButtonPress = useCallback(async () => {
    if (fileData !== null) {
      summaryRef.current = "";
      dispatch(setSummary(""));
      dispatch(setStreamingText(""));
      dispatch(setIsLoading(true));

      const handleUpdate = (chunk: string) => {
        summaryRef.current += chunk;
        dispatch(setStreamingText(summaryRef.current));
      };

      const { data, error } = await summarizeFile({
        file: fileData,
        summaryType,
        onSummaryUpdate: handleUpdate,
      });

      dispatch(setIsLoading(false));

      if (error) {
        console.error("File summary error:", error);
        toast.error(`An error occurred while summarizing the file: ${error}`);
      } else {
        const summaryToSave = summaryRef.current || data?.text || "";
        if (summaryToSave) {
          summaryRef.current = summaryToSave;
          dispatch(setSummary(summaryToSave));
          dispatch(
            addHistoryItem({
              title: fileData.name,
              sourceType: "file",
              summary: summaryToSave,
              source: fileData.name,
            }),
          );
          toast.success(
            `The summary for ${fileData.name} has been saved successfully.`,
          );
        }
      }
      dispatch(setStreamingText(""));
    }
  }, [fileData, summaryType, summarizeFile, dispatch]);

  const handleSummaryTypeChange = (value: SummaryType) => {
    dispatch(setSummaryType(value));
  };

  const handleChangeFileButtonPress = () => {
    fileInputRef.current!.click();
  };

  const handleDeleteFileButtonPress = () => {
    fileInputRef.current!.clear();
    dispatch(clearUploadFileTab());
    summaryRef.current = "";
  };

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-2 gap-8 px-16 pt-6 pb-16">
      <div className="flex flex-col">
        <p className="mb-2 font-medium">File to Summarize</p>
        {fileData && (
          <FileSelectedToSummarize
            fileName={fileData.name}
            isGeneratingSummary={isGeneratingSummary}
            onChangeFile={handleChangeFileButtonPress}
            onDeleteFile={handleDeleteFileButtonPress}
          />
        )}
        <FileInput
          ref={fileInputRef}
          data-testid="upload-file-file-input"
          errorMessage={errorMessage}
          totalSizeLimit={CLIENT_MAX_BODY_SIZE}
          className={`${fileData ? "hidden" : "visible"}`}
          supportedFileExtensions={SUPPORTED_FILE_EXTENSIONS}
          onDrop={handleFileInputDrop}
          onChange={handleFileInputChange}
        />
        <GenerateSummaryDropdownButton
          summaryType={summaryType}
          onSummaryTypeChange={handleSummaryTypeChange}
          onGenerateSummary={handleGenerateSummaryButtonPress}
          isDisabled={isGeneratingSummary}
          className="mt-4"
        />
      </div>
      <div className="h-full min-h-0 flex-1 overflow-y-auto">
        <GeneratedSummary
          summary={summary}
          isLoading={isLoading}
          fileName={fileData?.name}
          data={data}
          streamingText={streamingText}
        />
      </div>
    </div>
  );
};

export default UploadFileTab;
