// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { ErrorIcon, SuccessIcon } from "@intel-enterprise-rag-ui/icons";
import { useSelector } from "react-redux";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { selectColorScheme } from "@/ColorSchemeSwitch/colorScheme.slice";

// Only success/error styling — ERAG's NotificationSeverity is "success" | "error"
// only (no info/warning variant exists in Alert either, see Alert.tsx), so this
// doesn't invent tokens for severities nothing dispatches.
const Toaster = ({ ...props }: ToasterProps) => {
  // This app's dark mode is Redux-driven (ColorSchemeSwitch), not next-themes —
  // Sonner needs an explicit theme prop to render its own light/dark CSS variant.
  const colorScheme = useSelector(selectColorScheme);

  return (
    <Sonner
      theme={colorScheme}
      className="toaster group"
      icons={{
        success: <SuccessIcon className="text-success size-4" />,
        error: <ErrorIcon className="text-destructive size-4" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "calc(var(--radius) * 0.8)",
          "--success-bg":
            "color-mix(in srgb, var(--success) 10%, var(--popover))",
          "--success-text": "var(--success)",
          "--success-border":
            "color-mix(in oklch, var(--success) 30%, transparent)",
          "--error-bg":
            "color-mix(in srgb, var(--destructive) 10%, var(--popover))",
          "--error-text": "var(--destructive)",
          "--error-border":
            "color-mix(in oklch, var(--destructive) 30%, transparent)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      richColors
      {...props}
    />
  );
};

export { Toaster };
