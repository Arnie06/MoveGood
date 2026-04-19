import { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function HoverTooltip({
  children,
  content,
  className
}: {
  children: ReactNode;
  content: string;
  className?: string;
}) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      {children}
      <span className="pointer-events-none absolute left-1/2 top-full z-20 hidden w-64 -translate-x-1/2 rounded-2xl bg-[#102542] px-3 py-2 text-xs leading-5 text-white shadow-xl group-hover:block">
        {content}
      </span>
    </span>
  );
}
