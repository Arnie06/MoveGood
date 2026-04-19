import type React from "react";

import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "good" | "warn" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        tone === "default" && "bg-ocean/10 text-ocean",
        tone === "good" && "bg-moss/15 text-moss",
        tone === "warn" && "bg-clay/15 text-clay",
        tone === "muted" && "bg-black/5 text-gray-600",
        className
      )}
      {...props}
    />
  );
}
