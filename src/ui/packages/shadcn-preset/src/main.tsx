// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "@/harness.css";

import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <App />
    </ThemeProvider>
  </StrictMode>,
);

// a11y audit: exposes an on-demand axe-core scan of the harness, driven from outside
// (e.g. preview_eval) since this file is dev-only and never shipped.
if (import.meta.env.DEV) {
  import("axe-core").then((axe) => {
    (window as unknown as { runAxeScan: () => Promise<unknown> }).runAxeScan =
      () => axe.default.run();
  });
}
