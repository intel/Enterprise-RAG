// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { useColorScheme } from "@/ColorSchemeSwitch/useColorScheme";
import { IconButton } from "@/IconButton/IconButton";
import { Tooltip } from "@/Tooltip/Tooltip";

/**
 * Icon button for toggling between light and dark mode — shows the icon for the currently active
 * mode, with a tooltip naming which mode that is.
 */
export const ColorSchemeSwitch = () => {
  const { colorScheme, toggleColorScheme } = useColorScheme();

  const isLight = colorScheme === "light";
  const modeLabel = isLight ? "Light mode active" : "Dark mode active";

  return (
    <Tooltip
      title={modeLabel}
      trigger={
        <IconButton
          data-testid="color-scheme-switch"
          icon={isLight ? "light-mode" : "dark-mode"}
          aria-label={modeLabel}
          onPress={toggleColorScheme}
        />
      }
      placement="bottom"
    />
  );
};
