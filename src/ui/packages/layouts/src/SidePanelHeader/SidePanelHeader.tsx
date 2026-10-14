// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { AboutDialog } from "@/AboutDialog/AboutDialog";

export interface SidePanelHeaderProps {
  /** Primary line — the app's own display name (e.g. "ChatQnA") */
  title: string;
  /** Secondary line — the suite name and release version (e.g. "Intel® AI for Enterprise RAG v1.2.0") */
  subtitle: string;
  /** Suite name, passed through to the About dialog's own body content */
  appName: string;
  /** Suite version, passed through to the About dialog's own body content */
  appVersion: string;
  userGuideUrl?: string;
}

/**
 * First row inside the side panel — matches the app header's height. Pairs the app's identity
 * (title/subtitle) with the About dialog trigger, vertically centered on the right.
 */
export const SidePanelHeader = ({
  title,
  subtitle,
  appName,
  appVersion,
  userGuideUrl,
}: SidePanelHeaderProps) => (
  <div className="flex w-full min-w-0 items-center justify-between gap-2">
    <div className="flex min-w-0 flex-col justify-center">
      <p className="text-foreground mb-0.5 truncate text-sm leading-5 font-bold">
        {title}
      </p>
      <p className="text-muted-foreground truncate text-xs leading-4">
        {subtitle}
      </p>
    </div>
    <AboutDialog
      appName={appName}
      appVersion={appVersion}
      userGuideUrl={userGuideUrl}
    />
  </div>
);
