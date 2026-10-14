// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { IconName, icons } from "@intel-enterprise-rag-ui/icons";
import { cn } from "@intel-enterprise-rag-ui/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type MouseEvent } from "react";

export type IconButtonVariant =
  | "default"
  | "destructive"
  | "success"
  | "outline"
  | "ghost";
type IconButtonSize = "sm" | "md" | "lg";

const iconButtonVariants = cva(
  "flex size-7 cursor-pointer items-center justify-center rounded-md p-1.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        destructive:
          "text-destructive hover:bg-black/30 disabled:text-muted-foreground",
        success:
          "text-success hover:bg-black/30 disabled:text-muted-foreground",
        outline:
          "border-input text-foreground border bg-transparent hover:bg-accent hover:text-accent-foreground disabled:cursor-default disabled:border-transparent disabled:bg-muted disabled:text-muted-foreground dark:disabled:bg-transparent",
        ghost:
          "text-foreground hover:bg-accent hover:text-accent-foreground disabled:text-muted-foreground",
      },
      size: {
        md: "",
        sm: "size-6 p-1 text-sm",
        lg: "size-8 p-2 text-base",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "md",
    },
  },
);

export interface IconButtonProps
  extends
    Omit<ButtonPrimitive.Props, "onClick" | "disabled" | "color">,
    Omit<VariantProps<typeof iconButtonVariants>, "size"> {
  /** Name of the icon to display */
  icon: IconName;
  /** Size of the button (small, medium) */
  size?: IconButtonSize;
  /** Additional classes to apply to the icon */
  iconClassName?: string;
  /** If true, button is disabled */
  isDisabled?: boolean;
  /** Callback fired when the button is pressed */
  onPress?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Test identifier for automated testing */
  "data-testid"?: string;
}

/**
 * Icon button component for actions represented by icons, supporting variant and size options.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      size = "md",
      variant,
      iconClassName,
      className,
      isDisabled,
      onPress,
      ...rest
    },
    ref,
  ) => {
    // Base UI's Trigger `render` prop clones this element and injects its own
    // `onClick` (e.g. to open a Dialog/Menu) — must be composed with `onPress`,
    // not overwritten, or every Dialog/Menu/Tooltip trigger silently stops working.
    const { onClick, ...restProps } = rest as typeof rest & {
      onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
    };
    const IconComponent = icons[icon];

    return (
      <ButtonPrimitive
        {...restProps}
        ref={ref}
        data-slot="icon-button"
        disabled={isDisabled}
        onClick={(event) => {
          onClick?.(event);
          onPress?.(event);
        }}
        className={cn(iconButtonVariants({ variant, size }), className)}
      >
        <IconComponent className={iconClassName} />
      </ButtonPrimitive>
    );
  },
);

IconButton.displayName = "IconButton";
