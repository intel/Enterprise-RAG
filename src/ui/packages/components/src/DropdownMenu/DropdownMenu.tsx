// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "@intel-enterprise-rag-ui/utils";
import {
  createContext,
  PropsWithChildren,
  ReactElement,
  useContext,
  useEffect,
  useState,
} from "react";

import { parsePlacement } from "@/lib/placement";

type MenuSelectionMode = "none" | "single" | "multiple";

interface MenuContextValue {
  onAction?: (key: string) => void;
  selectionMode?: MenuSelectionMode;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
}

const MenuContext = createContext<MenuContextValue>({});

export interface DropdownMenuProps extends PropsWithChildren {
  /** Callback fired with the activated item's id */
  onAction?: (key: string) => void;
  /** Selection behavior for menu items */
  selectionMode?: MenuSelectionMode;
  /** Currently selected item ids (only relevant when selectionMode isn't "none") */
  selectedKeys?: string[];
  /** Callback fired when selection changes */
  onSelectionChange?: (keys: string[]) => void;
  /** Additional CSS classes */
  className?: string;
  /** Test identifier for automated testing */
  "data-testid"?: string;
}

/**
 * Dropdown menu component for rendering a list of selectable actions or options.
 */
const DropdownMenu = ({
  children,
  onAction,
  selectionMode = "none",
  selectedKeys,
  onSelectionChange,
  className,
  ...rest
}: DropdownMenuProps) => (
  <MenuContext.Provider
    value={{ onAction, selectionMode, selectedKeys, onSelectionChange }}
  >
    <div className={cn("py-1", className)} {...rest}>
      {children}
    </div>
  </MenuContext.Provider>
);

export interface DropdownMenuItemProps extends PropsWithChildren {
  /** Identifier passed to the parent DropdownMenu's onAction/onSelectionChange */
  id: string;
  /** If true, the item is disabled */
  isDisabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Test identifier for automated testing */
  "data-testid"?: string;
}

/**
 * Dropdown menu item component for individual selectable option in a menu.
 */
const DropdownMenuItem = ({
  id,
  isDisabled,
  className,
  children,
  ...rest
}: DropdownMenuItemProps) => {
  const { onAction, selectionMode, selectedKeys, onSelectionChange } =
    useContext(MenuContext);
  const isSelected = selectionMode !== "none" && selectedKeys?.includes(id);

  const handleClick = () => {
    if (selectionMode === "single") {
      onSelectionChange?.([id]);
    }
    onAction?.(id);
  };

  return (
    <MenuPrimitive.Item
      {...rest}
      disabled={isDisabled}
      aria-selected={isSelected}
      onClick={handleClick}
      className={cn(
        "hover:bg-background/80 flex cursor-pointer items-center gap-2 px-2 py-1 text-xs/relaxed first-of-type:rounded-t-md last-of-type:rounded-b-md data-disabled:cursor-default data-disabled:opacity-50",
        className,
      )}
    >
      {children}
    </MenuPrimitive.Item>
  );
};

export interface DropdownMenuTriggerProps extends PropsWithChildren {
  /** Element that triggers the menu */
  trigger: ReactElement;
  /** Accessible label for the menu */
  ariaLabel?: string;
  /** Placement of the menu popover (e.g. "bottom start", "bottom end") */
  placement?: string;
  /** If true, menu is open */
  isOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (isOpen: boolean) => void;
}

/**
 * Dropdown menu trigger component for opening a menu via a trigger element.
 */
const DropdownMenuTrigger = ({
  trigger,
  ariaLabel = "Menu",
  placement = "bottom start",
  children,
  isOpen,
  onOpenChange,
}: DropdownMenuTriggerProps) => {
  const { side, align } = parsePlacement(placement);
  const [open, setOpen] = useState(isOpen ?? false);

  useEffect(() => {
    if (isOpen !== undefined) {
      setOpen(isOpen);
    }
  }, [isOpen]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <MenuPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <MenuPrimitive.Trigger render={trigger} />
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner
          side={side}
          align={align}
          sideOffset={8}
          className="z-[101]"
        >
          <MenuPrimitive.Popup
            aria-label={ariaLabel}
            className="bg-popover text-popover-foreground ring-foreground/10 rounded-lg p-1 text-xs/relaxed shadow-md ring-1"
          >
            {children}
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
};

export { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger };
