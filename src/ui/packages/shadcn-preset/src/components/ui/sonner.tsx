"use client";

import {
  CheckCircleIcon,
  InfoIcon,
  SpinnerIcon,
  WarningIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      // sonner only applies --success-bg/border/text (and --error-*) to the toast when
      // data-rich-colors="true" is set, which richColors turns on. Without it, those
      // variables are defined but never consumed and the toast stays --normal-bg colored
      // regardless of type.
      className="toaster group"
      icons={{
        success: (
          <CheckCircleIcon weight="fill" className="text-success size-4" />
        ),
        info: (
          <InfoIcon weight="fill" className="text-info-foreground size-4" />
        ),
        warning: <WarningIcon weight="fill" className="size-4" />,
        error: (
          <XCircleIcon weight="fill" className="text-destructive size-4" />
        ),
        loading: <SpinnerIcon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-md)",
          // ERAG status colors at the same 10%/30% tint already verified compliant for the
          // destructive Button/Badge variant (see index.css's --success/--destructive
          // comments). The fill blends into --popover (opaque) rather than transparent —
          // the toast has no opaque backdrop of its own, so a transparent-mixed fill let
          // page content directly behind it show through. The border stays transparent-
          // mixed since a thin outline doesn't have that see-through problem.
          // Mixed `in srgb`, not `in oklch`: srgb interpolation is a plain per-channel
          // blend, i.e. exactly what alpha-compositing a 10%-opacity fill over an opaque
          // --popover backdrop would produce (matching Alert's bg-success/10). Mixing
          // `in oklch` instead interpolates hue circularly, and at a 10%/90% weight the
          // result barely moves off --popover's own hue (281.5) toward --success's
          // (148.23) — it stays visibly blue/lavender instead of reading as green
          // (confirmed via computed-style canvas resolution: oklch mix resolved to
          // rgb(207,218,245), not a green tint at all).
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
          // ERAG has no brand warning status color and no Alert "warning" variant to
          // mirror (only success/error/info — see notifications.slice.ts, which only ever
          // dispatches success/error). Leaving this undefined lets richColors fall back to
          // sonner's own built-in yellow, which would clash with the brand-tinted blends
          // used everywhere else — --normal-* keeps it consistent instead, with the icon as
          // the only thing telling a warning toast apart from a plain one.
          "--warning-bg": "var(--popover)",
          "--warning-text": "var(--popover-foreground)",
          "--warning-border": "var(--border)",
          // Mirrors Alert's "info" variant exactly (see alert.tsx) — same --primary-derived
          // bg tint and the same --info-foreground text color (AA-safe in both modes,
          // unlike bare --primary in dark mode), so a toast and an alert of the same
          // severity look the same.
          "--info-bg": "color-mix(in srgb, var(--primary) 10%, var(--popover))",
          "--info-text": "var(--info-foreground)",
          "--info-border":
            "color-mix(in oklch, var(--primary) 30%, transparent)",
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
