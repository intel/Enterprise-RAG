// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@intel-enterprise-rag-ui/utils";
import { ReactNode } from "react";

export type TabId = string;

export interface Tab {
  name: string;
  id: TabId;
  panel: ReactNode;
  [key: string]: unknown;
}

interface TabsProps {
  /** Array that defines tab elements */
  tabs: Tab[];
  /** Currently selected tab */
  selectedTab: TabId;
  /** Handler for tab selection changes */
  onSelectionChange: (key: TabId) => void;
  /** Test identifier for automated testing */
  "data-testid"?: string;
}

export const Tabs = ({
  tabs,
  selectedTab,
  onSelectionChange,
  ...rest
}: TabsProps) => (
  <TabsPrimitive.Root
    {...rest}
    value={selectedTab}
    onValueChange={(value) => onSelectionChange(value as TabId)}
  >
    <TabsPrimitive.List className="bg-muted inline-flex h-8 w-fit items-center justify-center rounded-lg p-[3px]">
      {tabs.map((tab) => (
        <TabsPrimitive.Tab
          key={`${tab.id}-tab`}
          value={tab.id}
          aria-label={`${tab.name} Tab`}
          className={cn(
            "text-muted-foreground cursor-pointer rounded-md px-1.5 py-0.5 text-xs/relaxed font-medium whitespace-nowrap transition-all",
            "focus-visible:border-ring focus-visible:ring-ring/30 outline-none focus-visible:ring-2",
            "data-[selected]:bg-background data-[selected]:text-foreground",
          )}
        >
          {tab.name}
        </TabsPrimitive.Tab>
      ))}
    </TabsPrimitive.List>
    {tabs.map((tab) => (
      <TabsPrimitive.Panel
        key={`${tab.id}-panel`}
        value={tab.id}
        className="relative mt-2 max-h-[calc(100vh_-_8rem)] overflow-y-auto"
      >
        {tab.panel}
      </TabsPrimitive.Panel>
    ))}
  </TabsPrimitive.Root>
);
