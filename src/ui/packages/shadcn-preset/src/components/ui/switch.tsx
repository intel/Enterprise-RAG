import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "cn";

// Track height is 17px (default) / 14px (sm), under WCAG 2.5.8's 24x24 minimum touch
// target. Always pair with an adjacent <Label htmlFor> — native label-click delegation
// (verified working) is the only thing bringing this up to a compliant target size.
function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        // Track height uses exact integers (thumb size + 1px border on each side, e.g.
        // 16+1+1=18) rather than a fractional value — a fractional track height (the
        // previous 18.4px) leaves a subpixel remainder that rounds asymmetrically above vs.
        // below the thumb, reading as "not quite centered".
        "group/switch focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 peer relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent outline-none group-has-[:focus-visible]/field-label:border-transparent group-has-[:focus-visible]/field-label:ring-0 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-2 aria-invalid:ring-2 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-[size=default]:h-[18px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px]",
        className,
      )}
      // index.css's unlayered `* { transition: background-color ... }` rule always wins
      // over a layered Tailwind transition-* utility (same mechanism as Tabs' indicator,
      // see tabs.tsx). Set both the track's bg-color transition and the thumb's transform
      // transition inline, on the same duration, so the whole toggle animates as one move
      // rather than relying on the page-wide 0.3s rule for the track alone.
      style={{
        transitionProperty: "background-color",
        transitionDuration: "150ms",
        transitionTimingFunction: "ease-out",
      }}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        style={{
          transitionProperty: "transform",
          transitionDuration: "150ms",
          transitionTimingFunction: "ease-out",
        }}
        className="bg-background dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground pointer-events-none block rounded-full ring-0 group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
