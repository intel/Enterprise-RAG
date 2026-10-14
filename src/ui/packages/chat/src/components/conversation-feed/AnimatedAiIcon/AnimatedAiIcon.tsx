// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./AnimatedAiIcon.css";

import { AiIcon } from "@intel-enterprise-rag-ui/icons";
import classNames from "classnames";

interface AnimatedAiIconProps {
  className?: string;
}

/**
 * The `AiIcon` glyph with a breathing pulse animation — used both as the initial chat view's hero
 * icon (while no conversation exists yet) and as the chat conversation feed's loading indicator
 * while waiting for a response, so both moments share one visual identity instead of two unrelated
 * animations (a plain pulsing dot, previously).
 */
export const AnimatedAiIcon = ({ className }: AnimatedAiIconProps) => (
  <AiIcon className={classNames("animated-ai-icon", className)} />
);
