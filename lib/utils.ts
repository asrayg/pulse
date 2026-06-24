import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as a compact, human readable string. */
export function formatNumber(n: number | null | undefined, opts?: { currency?: boolean; decimals?: number }): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const { currency, decimals } = opts ?? {};
  const abs = Math.abs(n);
  let out: string;
  if (abs >= 1_000_000_000) out = (n / 1_000_000_000).toFixed(decimals ?? 1) + "B";
  else if (abs >= 1_000_000) out = (n / 1_000_000).toFixed(decimals ?? 1) + "M";
  else if (abs >= 1_000) out = (n / 1_000).toFixed(decimals ?? 1) + "K";
  else out = n.toFixed(decimals ?? (Number.isInteger(n) ? 0 : 2));
  return currency ? `$${out}` : out;
}

export function formatFull(n: number | null | undefined, currency = false): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const s = n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return currency ? `$${s}` : s;
}

export function formatPct(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`;
}

export function timeAgo(date: string | number | Date): string {
  const d = typeof date === "object" ? date : new Date(date);
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
