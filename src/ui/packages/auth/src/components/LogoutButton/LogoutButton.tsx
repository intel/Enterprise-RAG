// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { IconButton, Tooltip } from "@intel-enterprise-rag-ui/components";
import { MouseEvent } from "react";

interface LogoutButtonProps {
  onPress: (e: MouseEvent<HTMLButtonElement>) => void;
}

export const LogoutButton = ({ onPress }: LogoutButtonProps) => (
  <Tooltip
    title="Sign Out"
    trigger={
      <IconButton
        data-testid="logout-button"
        icon="logout"
        aria-label="Sign Out"
        onPress={onPress}
      />
    }
    placement="bottom"
  />
);
