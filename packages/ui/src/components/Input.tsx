"use client";

import { forwardRef } from "react";
import { cn } from "../utils/cn";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-label-md text-on-surface-variant"
          >
            {label}
          </label>
        ) : null}
        <div className="relative flex items-center">
          {leftIcon ? (
            <span className="absolute left-3 text-on-surface-variant">
              {leftIcon}
            </span>
          ) : null}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full rounded-lg bg-surface-container border border-outline-variant",
              "px-3 py-2.5 text-body-md text-on-surface",
              "placeholder:text-on-surface-variant/50",
              "focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30",
              "transition-all duration-200",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error && "border-error/60 focus:border-error/80 focus:ring-error/20",
              className,
            )}
            {...props}
          />
          {rightIcon ? (
            <span className="absolute right-3 text-on-surface-variant">
              {rightIcon}
            </span>
          ) : null}
        </div>
        {error ? (
          <p className="text-label-sm text-error">{error}</p>
        ) : hint ? (
          <p className="text-label-sm text-on-surface-variant/60">{hint}</p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";
