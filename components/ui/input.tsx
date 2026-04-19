import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-ink shadow-sm outline-none ring-0 transition focus:border-ocean/30 focus:shadow-md",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
