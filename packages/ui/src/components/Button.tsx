"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium text-label-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-40 select-none",
  {
    variants: {
      variant: {
        primary: [
          "bg-primary text-on-primary",
          "hover:bg-primary/90 hover:shadow-glow-primary",
          "active:scale-[0.98]",
        ],
        secondary: [
          "bg-secondary-container/20 text-secondary border border-secondary/30",
          "hover:bg-secondary-container/30 hover:border-secondary/50",
          "active:scale-[0.98]",
        ],
        ghost: [
          "text-on-surface-variant",
          "hover:bg-white/5 hover:text-on-surface",
          "active:scale-[0.98]",
        ],
        glass: [
          "bg-white/[0.06] border border-white/10 text-on-surface",
          "backdrop-blur-md",
          "hover:bg-white/10 hover:border-white/20",
          "active:scale-[0.98]",
        ],
        destructive: [
          "bg-error-container/20 text-error border border-error/30",
          "hover:bg-error-container/30",
          "active:scale-[0.98]",
        ],
      },
      size: {
        sm: "h-8 px-3 text-label-md",
        md: "h-10 px-4 text-label-lg",
        lg: "h-12 px-6 text-body-lg",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled ?? loading}
        {...props}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
