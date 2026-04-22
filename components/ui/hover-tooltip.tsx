"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

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
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; placeAbove: boolean } | null>(null);

  function updatePosition() {
    const anchor = anchorRef.current;
    if (!anchor || typeof window === "undefined") return;

    const rect = anchor.getBoundingClientRect();
    const tooltipWidth = 256;
    const horizontalPadding = 16;
    const centerX = rect.left + rect.width / 2;
    const left = Math.max(
      horizontalPadding + tooltipWidth / 2,
      Math.min(window.innerWidth - horizontalPadding - tooltipWidth / 2, centerX)
    );

    // Estimate tooltip height for top/bottom placement without layout thrash.
    const estimatedHeight = 84;
    const gap = 10;
    const placeAbove = rect.bottom + gap + estimatedHeight > window.innerHeight;
    const top = placeAbove ? rect.top - gap : rect.bottom + gap;

    setPosition({ left, top, placeAbove });
  }

  useEffect(() => {
    if (!open) return;

    const onReposition = () => updatePosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  function show() {
    updatePosition();
    setOpen(true);
  }

  function hide() {
    setOpen(false);
  }

  return (
    <span
      className={cn("relative inline-flex", className)}
      ref={anchorRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span className="inline-flex">{children}</span>
      {open && position ? (
        <span
          className="pointer-events-none fixed z-[220] w-64 rounded-2xl bg-[#102542] px-3 py-2 text-xs leading-5 text-white shadow-xl"
          style={{
            left: position.left,
            top: position.top,
            transform: position.placeAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)"
          }}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
