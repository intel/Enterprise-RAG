import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cn } from "cn";

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        // --border resolves to the same value as --popover/--card/--secondary in this
        // palette (see index.css's --border comment), so a plain bg-border divider is
        // invisible against any of those surfaces. Mixing in 50% --foreground guarantees a
        // real, visible line regardless of what surface it sits on, in either mode
        // (verified: 3.07:1 light / 4.50:1 dark against --popover, clearing the 3:1 WCAG
        // 1.4.11 non-text minimum with margin).
        "shrink-0 bg-[color-mix(in_oklch,var(--border),var(--foreground)_50%)] data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
