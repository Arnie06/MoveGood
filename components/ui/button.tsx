import * as React from "react";

import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "outline";
  size?: "default" | "sm" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ocean/40 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "default" &&
          "bg-ocean px-5 py-3 text-white hover:bg-ocean/90",
        variant === "secondary" &&
          "bg-clay px-5 py-3 text-white hover:bg-clay/90",
        variant === "ghost" && "px-4 py-2 text-gray-700 hover:bg-black/5",
        variant === "outline" &&
          "border border-black/10 bg-white px-5 py-3 text-ink hover:bg-sky/50",
        size === "sm" && "px-3 py-2 text-sm",
        size === "lg" && "px-6 py-3.5 text-base",
        className
      )}
      {...props}
    />
  )
);

Button.displayName = "Button";
