import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import * as React from "react";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        // No background at rest — border + text only (dark mode swaps both to white,
        // since text-primary's known dark-mode AA gap — see index.css's --primary
        // comment — would be even worse read against a translucent bg on hover). Hover is
        // a light 10%-opacity fill of that same color — bg-primary/10 (light) / bg-white/10
        // (dark) — light enough that the rest-state text color already clears AA against it
        // with a wide margin (6.38-7.67:1 for text-primary against page/card/popover,
        // 11.69-15.45:1 for white), so hover doesn't need its own text-color override.
        outline:
          "border-primary text-primary hover:bg-primary/10 hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-white dark:text-white dark:hover:bg-white/10",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        // Rest state (/10) still clears AA with margin against page/card/popover in both
        // modes. Hover was bumped to /20 for a more visible fill — that reopens the AA gap
        // this was originally capped to avoid: at /20, text-destructive measures below
        // 4.5:1 against page (4.15:1) and popover (3.80:1) backgrounds in light mode, and
        // against card/popover (4.25:1) in dark mode. Only light-on-card (4.55:1) and
        // dark-on-page (5.43:1) actually clear AA at this tint — known, accepted gap for
        // the rest.
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/10 dark:focus-visible:ring-destructive/40 dark:hover:bg-destructive/20",
      },
      size: {
        default:
          "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-sm px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-2.5 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
        lg: "h-10 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-9",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

// Behavior fix: this component wasn't forwardRef-wrapped, so when Base UI clones it as a
// Dialog/Menu/Tooltip/Popover trigger's `render` element, it had no real DOM node to attach
// its own ref/pointer handling to. React's dev-mode "cannot be given refs" warning flagged
// this all session, but it looked cosmetic since a plain .click() (bypassing real pointer
// events) still worked in testing — a real pointerdown/pointerup sequence does not: the
// trigger silently never opens. Confirmed and fixed by forwarding the ref through.
const Button = React.forwardRef<
  HTMLButtonElement,
  ButtonPrimitive.Props & VariantProps<typeof buttonVariants>
>(function Button(
  { className, variant = "default", size = "default", ...props },
  ref,
) {
  return (
    <ButtonPrimitive
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});

// Exporting the cva variants alongside the component is the upstream shadcn API.
// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants };
