"use client";

import { forwardRef } from "react";
import { cn } from "../utils/cn";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "panel" | "card" | "modal";
  glow?: boolean;
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, variant = "panel", glow = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl transition-all duration-200",
          variant === "panel" && [
            "bg-white/[0.03] backdrop-blur-[12px]",
            "border border-white/10",
          ],
          variant === "card" && [
            "bg-[#121212]/70 backdrop-blur-[20px]",
            "border border-white/[0.08]",
            "shadow-glass",
          ],
          variant === "modal" && [
            "bg-surface-container/90 backdrop-blur-[24px]",
            "border border-white/10",
            "shadow-glass",
          ],
          glow && "shadow-glow-primary",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
GlassPanel.displayName = "GlassPanel";
