// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { IconName, icons, LoadingIcon } from "@intel-enterprise-rag-ui/icons";
import { cn } from "@intel-enterprise-rag-ui/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type MouseEvent } from "react";

export type ButtonVariant =
  | "default"
  | "destructive"
  | "success"
  | "outline"
  | "ghost";
type ButtonSize = "sm";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-1 rounded-md px-2 text-xs/relaxed font-medium whitespace-nowrap select-none outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-default disabled:bg-muted disabled:text-muted-foreground [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20",
        success: "bg-success text-primary-foreground hover:bg-success/80",
        outline:
          "border-input text-foreground border bg-transparent hover:bg-accent hover:text-accent-foreground disabled:border-muted-foreground disabled:bg-transparent",
        ghost:
          "bg-transparent text-foreground hover:bg-secondary/50 disabled:bg-transparent",
      },
      size: {
        default: "h-7",
        sm: "h-6",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      fullWidth: false,
    },
  },
);

interface ButtonProps
  extends
    Omit<ButtonPrimitive.Props, "onClick" | "disabled">,
    Omit<VariantProps<typeof buttonVariants>, "size" | "fullWidth"> {
  /** Size of the button (small) */
  size?: ButtonSize;
  /** If true, button takes full width */
  fullWidth?: boolean;
  /** Name of the icon to display */
  icon?: IconName;
  /** If true, shows a spinning loading icon in place of `icon` and disables the button */
  isLoading?: boolean;
  /** If true, button is disabled */
  isDisabled?: boolean;
  /** Callback fired when the button is pressed */
  onPress?: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Button component for user actions, supporting variant, size, icon, and full width options.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant,
      size,
      fullWidth,
      icon,
      isLoading,
      className,
      children,
      isDisabled,
      onPress,
      ...rest
    },
    ref,
  ) => {
    // Base UI's Trigger `render` prop clones this element and injects its own
    // `onClick` (e.g. to open a Dialog/Menu) — must be composed with `onPress`,
    // not overwritten, or every Dialog/Menu/DropdownButton trigger silently stops working.
    const { onClick, ...restProps } = rest as typeof rest & {
      onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
    };

    let content = children;
    if (isLoading) {
      content = (
        <>
          <LoadingIcon />
          {children}
        </>
      );
    } else if (icon) {
      const IconComponent = icons[icon];
      content = (
        <>
          <IconComponent />
          {children}
        </>
      );
    }

    return (
      <ButtonPrimitive
        {...restProps}
        ref={ref}
        data-slot="button"
        disabled={isDisabled || isLoading}
        onClick={(event) => {
          onClick?.(event);
          onPress?.(event);
        }}
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      >
        {content}
      </ButtonPrimitive>
    );
  },
);

Button.displayName = "Button";
