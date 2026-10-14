// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  CheckboxCheckIcon,
  SelectInputArrowIcon,
} from "@intel-enterprise-rag-ui/icons";
import { cn } from "@intel-enterprise-rag-ui/utils";
import { useMemo, useRef, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/Command/Command";
import { Popover } from "@/Popover/Popover";

type ComboboxSize = "sm";
export type ComboboxChangeHandler<T extends string = string> = (
  item: T,
) => void;

interface ComboboxProps<T extends string = string> {
  /** Selected value */
  value?: T | null;
  /** List of selectable items */
  items?: string[];
  /** Size of the combobox trigger */
  size?: ComboboxSize;
  /** If true, disables the combobox */
  isDisabled?: boolean;
  /** Placeholder shown when nothing is selected */
  placeholder?: string;
  /** Placeholder for the search input inside the popup */
  searchPlaceholder?: string;
  /** Message shown when the search matches nothing */
  emptyText?: string;
  /** If true, combobox takes full width */
  fullWidth?: boolean;
  /** Callback for value change */
  onChange?: ComboboxChangeHandler<T>;
  /** Additional CSS classes */
  className?: string;
  /** Accessible label */
  "aria-label"?: string;
  /** Test identifier for automated testing */
  "data-testid"?: string;
}

/**
 * Combobox: a searchable Select, for lists too long to scan by eye. Same drop-in prop shape as
 * `Select` (`items`/`value`/`onChange`) with a filterable search input in the popup.
 */
export const Combobox = <T extends string = string>({
  value,
  items,
  size,
  isDisabled,
  placeholder,
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  fullWidth,
  onChange,
  className,
  ...rest
}: ComboboxProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);

  const filteredItems = useMemo(() => {
    if (!search) return items ?? [];
    const query = search.toLowerCase();
    return (items ?? []).filter((item) => item.toLowerCase().includes(query));
  }, [items, search]);

  const handleOpenChange = (nextIsOpen: boolean) => {
    setIsOpen(nextIsOpen);
    if (!nextIsOpen) setSearch("");
  };

  const handleSelect = (item: string) => {
    onChange?.(item as T);
    handleOpenChange(false);
  };

  return (
    <div className={cn("mb-3", size === "sm" && "mb-2", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={isDisabled}
        onClick={() => handleOpenChange(!isOpen)}
        className={cn(
          "border-input bg-background text-foreground flex h-7 items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-xs/relaxed",
          "disabled:pointer-events-none disabled:cursor-default disabled:bg-transparent",
          "focus-visible:border-ring focus-visible:ring-ring/30 outline-none focus-visible:ring-2",
          fullWidth && "w-full",
          size === "sm" && "h-6 py-0 pr-1 pl-2 text-xs",
        )}
        {...rest}
      >
        <span className="truncate">
          {value || placeholder || "Select value from the list"}
        </span>
        <SelectInputArrowIcon />
      </button>
      <Popover
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        triggerRef={triggerRef}
        placement="bottom start"
        className="w-[var(--anchor-width)] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={searchPlaceholder}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filteredItems.map((item) => (
                <CommandItem
                  key={item}
                  value={item}
                  onSelect={() => handleSelect(item)}
                >
                  <CheckboxCheckIcon
                    aria-hidden="true"
                    className={cn(
                      "size-3 shrink-0",
                      item === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {item}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </Popover>
    </div>
  );
};
