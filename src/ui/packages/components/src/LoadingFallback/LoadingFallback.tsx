// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { LoadingIcon } from "@intel-enterprise-rag-ui/icons";

interface LoadingFallbackProps {
  /** Message to display while loading */
  loadingMessage?: string;
}

/**
 * Loading fallback component for displaying a loading indicator and message.
 */
export const LoadingFallback = ({ loadingMessage }: LoadingFallbackProps) => (
  <div className="flex h-full w-full items-center justify-center">
    <div className="flex items-center">
      <LoadingIcon className="animate-spin" />
      <p className="mb-0 pl-3">{loadingMessage ?? "Loading..."}</p>
    </div>
  </div>
);
