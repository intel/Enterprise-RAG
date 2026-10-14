// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { useCallback } from "react";
import { toast } from "sonner";

import { useSpeechToTextMutation } from "@/features/chat/api/asr.api";
import { convertToWav } from "@/utils/audioConverter";

export const useSpeechToTextHandlers = () => {
  const [speechToText] = useSpeechToTextMutation();

  const handleSpeechToText = useCallback(
    async (audioBlob: Blob) => {
      const wavBlob = await convertToWav(audioBlob);
      const result = await speechToText({ audio: wavBlob }).unwrap();
      return result.text;
    },
    [speechToText],
  );

  const handleSpeechToTextError = useCallback((error: Error) => {
    toast.error(`Speech-to-text failed: ${error.message}`);
  }, []);

  return {
    handleSpeechToText,
    handleSpeechToTextError,
  };
};
