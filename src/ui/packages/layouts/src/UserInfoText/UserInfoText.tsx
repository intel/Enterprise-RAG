// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

interface UserInfoTextProps {
  /** User information to display (e.g. username or email) */
  text: string;
}

/**
 * Displays a line of user information (username, email, ...) in the side panel footer.
 */
export const UserInfoText = ({ text }: UserInfoTextProps) => (
  <p className="text-foreground overflow-hidden text-left text-xs leading-4 font-normal text-ellipsis whitespace-nowrap">
    {text}
  </p>
);
