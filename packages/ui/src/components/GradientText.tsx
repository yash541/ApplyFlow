"use client";

import { cn } from "../utils/cn";

interface GradientTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  as?: React.ElementType;
}

export function GradientText({
  className,
  as: Tag = "span",
  children,
  ...props
}: GradientTextProps) {
  return (
    <Tag
      className={cn(
        "bg-gradient-primary bg-clip-text text-transparent",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
