import { MATCH_SCORE_TIERS } from "../constants";

export function getMatchTier(score: number) {
  if (score >= MATCH_SCORE_TIERS.EXCELLENT.min) return MATCH_SCORE_TIERS.EXCELLENT;
  if (score >= MATCH_SCORE_TIERS.GOOD.min) return MATCH_SCORE_TIERS.GOOD;
  if (score >= MATCH_SCORE_TIERS.FAIR.min) return MATCH_SCORE_TIERS.FAIR;
  return MATCH_SCORE_TIERS.POOR;
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateString));
}

export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return formatDate(dateString);
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
