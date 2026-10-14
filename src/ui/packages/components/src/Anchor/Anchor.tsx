// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./Anchor.css";

import { ExternalLinkIcon } from "@intel-enterprise-rag-ui/icons";
import { cn, isSafeHref, sanitizeHref } from "@intel-enterprise-rag-ui/utils";
import { AnchorHTMLAttributes, MouseEvent, PropsWithChildren } from "react";

export interface AnchorProps
  extends AnchorHTMLAttributes<HTMLAnchorElement>, PropsWithChildren {
  /** If true, additional icon for indicating external links is displayed */
  isExternal?: boolean;
  /** Callback fired when the anchor is pressed */
  onPress?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * Anchor component for rendering a styled link with external indication and safe href handling.
 */
export const Anchor = ({
  children,
  isExternal,
  href,
  target = "_blank",
  className,
  onPress,
  ...rest
}: AnchorProps) => {
  const isSafe = isSafeHref(href);
  const safeHref = isSafe ? sanitizeHref(href) : undefined;
  const rel = target === "_blank" ? "noopener noreferrer" : undefined;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (onPress && isSafe) {
      onPress(event);
    }
  };

  return (
    <a
      {...rest}
      href={safeHref}
      target={target}
      rel={rel}
      className={cn(!isSafe && "invalid", className)}
      aria-disabled={!isSafe}
      onClick={handleClick}
    >
      {!isSafe && "Caution: Malicious link - "}
      {children}
      {isExternal && <ExternalLinkIcon size={12} />}
    </a>
  );
};
