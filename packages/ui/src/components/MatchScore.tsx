"use client";

import { cn } from "../utils/cn";

interface MatchScoreProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

function getScoreColor(score: number) {
  if (score >= 85) return { text: "text-success", ring: "stroke-success", bg: "bg-success" };
  if (score >= 70) return { text: "text-primary", ring: "stroke-primary", bg: "bg-primary" };
  if (score >= 50) return { text: "text-warning", ring: "stroke-warning", bg: "bg-warning" };
  return { text: "text-error", ring: "stroke-error", bg: "bg-error" };
}

function getScoreLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  return "Low";
}

const SIZES = {
  sm: { svg: 48, stroke: 4, fontSize: "text-xs", labelSize: "text-[9px]" },
  md: { svg: 72, stroke: 5, fontSize: "text-sm", labelSize: "text-[10px]" },
  lg: { svg: 96, stroke: 6, fontSize: "text-base", labelSize: "text-xs" },
};

export function MatchScore({
  score,
  size = "md",
  showLabel = true,
  className,
}: MatchScoreProps) {
  const { svg: svgSize, stroke, fontSize, labelSize } = SIZES[size];
  const colors = getScoreColor(score);
  const radius = (svgSize - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative" style={{ width: svgSize, height: svgSize }}>
        <svg
          width={svgSize}
          height={svgSize}
          className="-rotate-90"
          viewBox={`0 0 ${svgSize} ${svgSize}`}
        >
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            strokeWidth={stroke}
            className="stroke-white/10 fill-none"
          />
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className={cn("fill-none transition-all duration-700", colors.ring)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold font-display", fontSize, colors.text)}>
            {score}
          </span>
          {showLabel ? (
            <span className={cn("text-on-surface-variant/60", labelSize)}>
              match
            </span>
          ) : null}
        </div>
      </div>
      {showLabel ? (
        <span className={cn("font-medium", labelSize, colors.text)}>
          {getScoreLabel(score)}
        </span>
      ) : null}
    </div>
  );
}
