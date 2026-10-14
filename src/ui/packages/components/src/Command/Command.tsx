// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { SearchIcon } from "@intel-enterprise-rag-ui/icons";
import { cn } from "@intel-enterprise-rag-ui/utils";
import { Command as CommandPrimitive } from "cmdk";
import { ComponentProps } from "react";

export const Command = ({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive>) => (
  <CommandPrimitive
    className={cn(
      "text-popover-foreground flex h-full w-full flex-col outline-none",
      className,
    )}
    {...props}
  />
);

export const CommandInput = ({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Input>) => (
  <div className="border-border flex items-center gap-2 border-b px-2.5 py-1.5">
    <SearchIcon aria-hidden="true" className="text-muted-foreground size-3" />
    <CommandPrimitive.Input
      className={cn(
        "placeholder:text-muted-foreground w-full text-xs/relaxed outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  </div>
);

export const CommandList = ({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.List>) => (
  <CommandPrimitive.List
    className={cn("max-h-64 overflow-x-hidden overflow-y-auto p-1", className)}
    {...props}
  />
);

export const CommandEmpty = (
  props: ComponentProps<typeof CommandPrimitive.Empty>,
) => (
  <CommandPrimitive.Empty
    className="py-4 text-center text-xs/relaxed"
    {...props}
  />
);

export const CommandGroup = ({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Group>) => (
  <CommandPrimitive.Group
    className={cn("text-foreground overflow-hidden", className)}
    {...props}
  />
);

export const CommandItem = ({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Item>) => (
  <CommandPrimitive.Item
    className={cn(
      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs/relaxed outline-none select-none",
      "data-[selected=true]:bg-secondary aria-disabled:pointer-events-none aria-disabled:opacity-50",
      className,
    )}
    {...props}
  />
);
