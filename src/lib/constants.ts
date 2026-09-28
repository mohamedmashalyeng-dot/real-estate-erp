/** Cross-cutting constants shared by server and client code. */

export const ACTIVE_ORGANIZATION_COOKIE = "estateiq.active_org";

export const PAGE_SIZE_DEFAULT = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export const DEFAULT_CURRENCY = "EGP";

export const LEAD_STAGES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "VIEWING",
  "NEGOTIATION",
  "RESERVATION",
  "WON",
  "LOST",
] as const;

export const OPEN_LEAD_STAGES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "VIEWING",
  "NEGOTIATION",
  "RESERVATION",
] as const;

export const LEAD_SOURCES = [
  "FACEBOOK",
  "INSTAGRAM",
  "GOOGLE",
  "TIKTOK",
  "WEBSITE",
  "WHATSAPP",
  "REFERRAL",
  "WALK_IN",
  "PROPERTY_PORTAL",
  "OTHER",
] as const;

export const UNIT_STATUSES = [
  "AVAILABLE",
  "RESERVED",
  "SOLD",
  "BLOCKED",
  "UNAVAILABLE",
] as const;

export const DASHBOARD_RANGES = [
  "today",
  "7d",
  "30d",
  "quarter",
  "year",
  "custom",
] as const;

export type DashboardRange = (typeof DASHBOARD_RANGES)[number];
