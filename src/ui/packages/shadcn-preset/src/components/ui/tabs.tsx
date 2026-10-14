"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className,
      )}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list relative inline-flex w-fit items-center justify-center rounded-md text-muted-foreground group-data-horizontal/tabs:h-9 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        // Deliberately not bg-muted: --muted is ERAG's own "disabled" surface token
        // (light-bg-disabled/dark-bg-disabled), and a Tabs track isn't a disabled-looking
        // surface. --secondary has near-identical lightness (verified: inactive-tab text
        // still clears 4.5:1 against it) without that borrowed semantic.
        default: "bg-secondary",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsIndicator({
  className,
  style,
  ...props
}: TabsPrimitive.Indicator.Props) {
  return (
    <TabsPrimitive.Indicator
      data-slot="tabs-indicator"
      className={cn(
        // bg-primary in both modes, matching the default Button variant's own background
        // exactly (rather than following ERAG's original dark-accent, which diverges to
        // white in dark mode) — the active tab reads as the same "primary" affordance as a
        // primary button, consistently across light/dark.
        "bg-primary absolute top-[var(--active-tab-top)] left-[var(--active-tab-left)] z-0 h-[var(--active-tab-height)] w-[var(--active-tab-width)] rounded-md",
        className,
      )}
      // index.css has an unlayered `* { transition: background-color ... }` rule (from
      // ERAG's original CSS) that always wins over a layered Tailwind transition-* utility
      // per CSS cascade-layer rules, regardless of specificity. Inline style is the only
      // thing that reliably wins over that, so the slide animation is set here rather than
      // via a class.
      style={{
        transitionProperty: "left, top, width, height",
        transitionDuration: "200ms",
        transitionTimingFunction: "ease-out",
        ...style,
      }}
      {...props}
    />
  );
}

function TabsList({
  className,
  variant = "default",
  children,
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {variant === "default" && <TabsIndicator />}
      {children}
    </TabsPrimitive.List>
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        // ERAG contrast fix: text-foreground/60 measured 3.66:1 against --muted with ERAG's
        // lighter --foreground (below WCAG AA 4.5:1); text-muted-foreground already matches
        // what dark mode uses for this same inactive-tab role and passes AA.
        // Active-state color change (text-muted-foreground -> text-primary-foreground) is
        // delayed to match the sliding indicator's 200ms travel time (see TabsIndicator) —
        // otherwise the text turns white before the background pill finishes moving under it.
        "text-muted-foreground hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:hover:text-foreground relative z-10 inline-flex h-[calc(100%-1px)] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start group-data-vertical/tabs:py-1.5 focus-visible:ring-2 focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-active:delay-200 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        // primary-foreground (white) pairs with the indicator's bg-primary fill in both
        // modes now (see TabsIndicator). No border — the active background itself lives on
        // the shared, sliding TabsIndicator instead of toggling per trigger, so switching
        // tabs animates as one chip moving rather than a hard swap.
        "data-active:text-primary-foreground data-active:border-transparent",
        // Active tab keeps its text color static on hover (no change needed, it's already
        // primary-foreground). It must still show the normal focus-visible ring/border/
        // outline like any other tab — WCAG 2.4.7 requires a visible focus indicator on
        // whichever tab has keyboard focus, active or not. An earlier version neutralized
        // focus-visible entirely for the active tab, which made tabbing to the selected tab
        // show no focus indicator at all.
        "data-active:hover:text-primary-foreground",
        "after:bg-foreground after:absolute after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:-bottom-1 group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  );
}

export {
  Tabs,
  TabsContent,
  TabsIndicator,
  TabsList,
  // Exporting the cva variants alongside the component is the upstream shadcn API.
  // eslint-disable-next-line react-refresh/only-export-components
  tabsListVariants,
  TabsTrigger,
};
