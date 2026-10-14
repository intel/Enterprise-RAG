// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { LogoutButton } from "@intel-enterprise-rag-ui/auth";

import { UserInfoText } from "@/UserInfoText/UserInfoText";

export interface SidePanelFooterProps {
  username: string;
  userEmail?: string;
  onLogout: () => void;
}

/**
 * Account controls pinned to the bottom of a side panel — moved out of the app header so they
 * stay reachable from a single, consistent location regardless of route. The color scheme switch
 * lives in the app header; the app name/project/version + About dialog live in the side panel's
 * own header row, and the view switch (plus, for chat, the New Chat button) lives just below that
 * — none of those are part of this footer.
 */
export const SidePanelFooter = ({
  username,
  userEmail,
  onLogout,
}: SidePanelFooterProps) => (
  <div className="flex flex-1 items-center justify-between gap-2">
    <div className="flex min-w-0 flex-col">
      <UserInfoText text={username} />
      {userEmail && <UserInfoText text={userEmail} />}
    </div>
    <LogoutButton onPress={onLogout} />
  </div>
);
