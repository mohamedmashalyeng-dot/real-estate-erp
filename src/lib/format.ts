/**
 * Small formatting helpers shared by server and client components.
 * All money values come from Prisma `Decimal` columns and are rendered here.
 */

export type Numeric = number | string | { toString(): string } | null | undefined;

export function toNumber(value: Numeric): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseFloat(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toDecimalString(value: Numeric): string {
  return toNumber(value).toFixed(2);
}

export function formatMoney(
  value: Numeric,
  currency = "EGP",
  options: { compact?: boolean; maximumFractionDigits?: number } = {},
): string {
  const amount = toNumber(value);
  const maximumFractionDigits = options.maximumFractionDigits ?? (options.compact ? 1 : 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: options.compact ? "compact" : "standard",
    maximumFractionDigits,
  }).format(amount);
}

export function formatNumber(value: Numeric, fractionDigits = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(toNumber(value));
}

export function formatPercent(value: Numeric, fractionDigits = 1): string {
  return `${toNumber(value).toFixed(fractionDigits)}%`;
}

export function formatArea(value: Numeric): string {
  return `${formatNumber(toNumber(value), 0)} m²`;
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRelative(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(diffMinutes);
  if (abs < 60) return formatter.format(diffMinutes, "minute");
  if (abs < 60 * 24) return formatter.format(Math.round(diffMinutes / 60), "hour");
  if (abs < 60 * 24 * 30) return formatter.format(Math.round(diffMinutes / (60 * 24)), "day");
  return formatter.format(Math.round(diffMinutes / (60 * 24 * 30)), "month");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}
