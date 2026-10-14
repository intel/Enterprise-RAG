// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0
// Dev-only harness entry — never shipped, excluded from build.lib.

import "./index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppProvider } from "../src/AppProvider/AppProvider";
import { Harness } from "./Harness";
import { harnessStore } from "./store";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider store={harnessStore}>
      <Harness />
    </AppProvider>
  </StrictMode>,
);

// Task 12 a11y pass: exposes an on-demand axe-core scan of the harness, driven from outside
// (e.g. preview_eval) since this file is dev-only and never shipped.
if (import.meta.env.DEV) {
  import("axe-core").then((axe) => {
    (window as unknown as { runAxeScan: () => Promise<unknown> }).runAxeScan =
      () => axe.default.run();
  });
}
