// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

const CHAT_DISCLAIMER_DEFAULT_MESSAGE =
  "Responses from this solution may require further verification. You are solely responsible for verifying the accuracy of the information provided and how you choose to use it.";

interface ChatDisclaimerProps {
  message?: string;
}

export const ChatDisclaimer = ({
  message = CHAT_DISCLAIMER_DEFAULT_MESSAGE,
}: ChatDisclaimerProps) => (
  <p className="text-muted-foreground mx-auto my-4 w-[calc(100%_-_2rem)] max-w-full text-center text-xs leading-[0.875rem] font-normal md:w-[46rem]">
    {message}
  </p>
);
