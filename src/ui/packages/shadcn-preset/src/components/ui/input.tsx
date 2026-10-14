import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "cn";
import * as React from "react";

function Input({
  className,
  type,
  size = "default",
  ...props
}: React.ComponentProps<"input"> & { size?: "sm" | "default" }) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(
        "border-input file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 w-full min-w-0 rounded-md border bg-white text-sm transition-colors outline-none file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 data-[size=default]:h-9 data-[size=default]:px-2.5 data-[size=default]:py-1 data-[size=default]:file:h-7 data-[size=sm]:h-8 data-[size=sm]:px-2 data-[size=sm]:py-1 data-[size=sm]:file:h-6 dark:bg-black",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
