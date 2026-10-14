// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0
// Dev-only minimal store for the harness — mirrors what AppProvider needs, nothing more.

import { configureStore } from "@reduxjs/toolkit";

import { colorSchemeReducer } from "../src/ColorSchemeSwitch/colorScheme.slice";

export const harnessStore = configureStore({
  reducer: {
    colorScheme: colorSchemeReducer,
  },
});
