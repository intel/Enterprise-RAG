// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  IconButton,
  IconButtonProps,
} from "@intel-enterprise-rag-ui/components";
import classNames from "classnames";

interface ScrollToBottomButtonProps extends Omit<
  IconButtonProps,
  "color" | "icon"
> {
  show: boolean;
}

export const ScrollToBottomButton = ({
  show,
  className,
  ...rest
}: ScrollToBottomButtonProps) => (
  <IconButton
    {...rest}
    data-testid="scroll-to-bottom-button"
    icon="scroll-to-bottom"
    aria-label="Scroll to bottom"
    className={classNames([
      // hover:bg-primary/hover:text-primary-foreground keep the ghost variant's hover tint off,
      // which the old unlayered BEM rule overrode
      "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground absolute right-1/2 bottom-4 z-10 size-8 translate-x-1/2 rounded-full text-sm shadow-md shadow-black/50 transition-all duration-300 ease-in-out",
      show
        ? "pointer-events-auto visible translate-y-0 opacity-100"
        : "pointer-events-none invisible translate-y-4 opacity-0",
      className,
    ])}
  />
);
