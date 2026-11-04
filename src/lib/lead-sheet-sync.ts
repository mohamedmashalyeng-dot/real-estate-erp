import { createHash } from "node:crypto";
import type { LeadSource, LeadStage, UnitType } from "@/generated/prisma/enums";
import { LEAD_STAGES } from "./constants";
import { AppError } from "./errors";
import { fetchSheetCsv, listSheetTabs, parseCsv, parseSpreadsheetId, type SheetTab } from "./google-sheets";
import type { TenantScopedClient } from "./prisma";

/**
 * Google Sheet → CRM lead import.
 *
 * Every tab whose header row has a lead-name and a phone column (e.g. the
 * monthly "OCT(10) 2026" tracker) is imported; other tabs such as dashboards
 * are skipped. Each row is linked to one lead through `Lead.externalRef`
 * (the normalized phone, or tab + row number when the phone is missing) and
 * is re-applied only when its content hash changes, so CRM-side work on rows
 * nobody touched in the sheet is never overwritten.
 */

/** Bump when the mapping below changes so the next sync re-applies every row. */
const MAPPING_VERSION = 1;

/** Sheets store numbers without the leading zero, so local numbers lose it. */
const DEFAULT_CALLING_CODE = "20"; // Egypt

const ACTIVITY_SOURCE = "google-sheet";

type SheetField =
  | "serial"
  | "date"
  | "name"
  | "phone"
  | "contactTime"
  | "jobTitle"
  | "email"
  | "project"
  | "area"
  | "unitSize"
  | "paymentPlan"
  | "consultant"
  | "source"
  | "status"
  | "siteVisit"
  | "qualification"
  | "notes";

/** Header aliases, compared after `normalizeHeader` (lower case, no spaces/punctuation). */
const HEADER_ALIASES: Record<SheetField, readonly string[]> = {
  serial: ["", "no", "sn", "م"],
  date: ["date", "التاريخ"],
  name: ["newlead", "name", "leadname", "clientname", "الاسم", "اسمالعميل"],
  phone: ["phone", "mobile", "phonenumber", "الموبايل", "التليفون", "رقمالهاتف"],
  contactTime: ["timetoconnect", "time", "الوقت"],
  jobTitle: ["jobtitle", "job", "الوظيفة"],
  email: ["email", "mail"],
  project: ["project", "المشروع"],
  area: ["preferredaream²", "preferredarea", "area", "المساحة"],
  unitSize: ["interestedunitsize", "unitsize"],
  paymentPlan: ["preferredpaymentplan", "paymentplan", "طريقةالدفع"],
  consultant: ["salesconsultant", "consultant", "salesagent", "agent"],
  source: ["typesource", "source", "leadsource", "المصدر"],
  status: ["status", "الحالة"],
  siteVisit: ["sitevisit", "visit", "المعاينة"],
  qualification: ["yesno", "qualified", "qualification"],
  notes: ["notes", "note", "ملاحظات"],
};

const UNKNOWN_NAMES = new Set(["غير معروف", "غير معروفه", "مجهول", "unknown", "-", "?"]);

const SOURCE_KEYWORDS: ReadonlyArray<[LeadSource, RegExp]> = [
  ["WHATSAPP", /whats|wats|واتس/i],
  ["FACEBOOK", /face|\bfb\b|فيس/i],
  ["INSTAGRAM", /insta|انستا/i],
  ["TIKTOK", /tik\s?tok|تيك/i],
  ["GOOGLE", /google|جوجل/i],
  ["PROPERTY_PORTAL", /portal|aqar\s?map|property\s?finder|olx|dubizzle|عقار\s?ماب/i],
  ["WEBSITE", /web|site/i],
  ["REFERRAL", /refer|ترشيح/i],
  ["WALK_IN", /walk/i],
];

const PROPERTY_TYPE_KEYWORDS: ReadonlyArray<[UnitType, RegExp]> = [
  ["RETAIL", /تجاري|محل|retail|shop|commercial|mall/i],
  ["OFFICE", /إداري|اداري|مكتب|office/i],
  ["DUPLEX", /دوبلكس|duplex/i],
  ["PENTHOUSE", /بنتهاوس|penthouse/i],
  ["TOWNHOUSE", /تاون|townhouse/i],
  ["VILLA", /فيلا|villa/i],
  ["STUDIO", /ستوديو|استوديو|studio/i],
  ["CHALET", /شاليه|chalet/i],
  ["APARTMENT", /شقة|شقه|شقق|apartment|flat/i],
  ["LAND", /^(أرض|ارض)|\bland\b|\bplot\b/i],
];

export interface SheetColumns {
  fields: Partial<Record<SheetField, number>>;
  feedback: { label: string; index: number }[];
}

export interface SheetLead {
  /** Lead.externalRef: phone based when possible so a lead survives row moves. */
  key: string;
  /** Tab + row identity, used to re-link a row whose phone was filled in later. */
  rowKey: string;
  hash: string;
  tabName: string;
  rowNumber: number;
  firstName: string | null;
  lastName: string;
  phone: string | null;
  email: string | null;
  createdAt: Date | null;
  stage: LeadStage;
  lostReason: string | null;
  source: LeadSource | null;
  propertyType: UnitType | null;
  projectName: string | null;
  consultantName: string | null;
  notes: string | null;
  feedback: { label: string; body: string }[];
}

export interface SheetSyncSummary {
  tabs: string[];
  created: number;
  updated: number;
  unchanged: number;
  unmatchedConsultants: string[];
  unmatchedProjects: string[];
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Levenshtein distance, giving up (returns max + 1) once it exceeds `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    if (Math.min(...current) > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

/**
 * Exact (case-insensitive) project name, else the only project one typo away,
 * e.g. "Park Octoper" -> "Park October". Short names and names whose digits
 * differ ("Tower 1" / "Tower 2") must match exactly.
 */
export function matchProjectName(name: string, projects: { id: string; name: string }[]): string | null {
  const target = normalizeText(name);
  const exact = projects.find((project) => normalizeText(project.name) === target);
  if (exact) return exact.id;
  if (target.length < 8) return null;
  const digits = (value: string) => value.replace(/\D/g, "");
  const close = projects.filter((project) => {
    const candidate = normalizeText(project.name);
    return digits(candidate) === digits(target) && editDistance(candidate, target, 1) <= 1;
  });
  return close.length === 1 ? close[0].id : null;
}

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\r/g, "").trim();
}

/** Finds the header row (within the first rows) and maps its columns. */
export function detectSheetColumns(rows: string[][]): { headerRow: number; columns: SheetColumns } | null {
  for (let headerRow = 0; headerRow < Math.min(rows.length, 10); headerRow++) {
    const columns: SheetColumns = { fields: {}, feedback: [] };
    rows[headerRow].forEach((header, index) => {
      const normalized = normalizeHeader(header);
      if (/^(feedback|متابعة)\d*$/.test(normalized)) {
        columns.feedback.push({ label: clean(header), index });
        return;
      }
      for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [SheetField, readonly string[]][]) {
        if (columns.fields[field] === undefined && aliases.includes(normalized)) {
          columns.fields[field] = index;
          return;
        }
      }
    });
    if (columns.fields.name !== undefined && columns.fields.phone !== undefined) {
      return { headerRow, columns };
    }
  }
  return null;
}

export function normalizeSheetPhone(raw: string): string | null {
  const latin = raw.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
  let digits = latin.replace(/\D/g, "");
  if (latin.trim().startsWith("00")) digits = digits.slice(2);
  if (digits.length < 7 || /^0+$/.test(digits)) return null;
  // Egyptian mobile typed without its leading zero (1xxxxxxxxx).
  if (/^1[0125]\d{8}$/.test(digits)) return `+${DEFAULT_CALLING_CODE}${digits}`;
  if (digits.startsWith("0")) return `+${DEFAULT_CALLING_CODE}${digits.slice(1)}`;
  return `+${digits}`;
}

/** Offset of `timeZone` from UTC at `date`, in milliseconds. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value);
  const asUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return asUtc - date.getTime();
}

/**
 * Parses the sheet's DATE ("10/5/2026", month first as Google Sheets exports
 * it for US locale; day first is detected when the first number is > 12) and
 * optional time ("10:00 PM") as wall-clock time in the organization timezone.
 */
export function parseSheetDateTime(dateText: string, timeText: string, timeZone: string): Date | null {
  let year: number;
  let month: number;
  let day: number;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(dateText);
  const slashed = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(dateText);
  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (slashed) {
    [month, day, year] = [Number(slashed[1]), Number(slashed[2]), Number(slashed[3])];
    if (month > 12) [month, day] = [day, month];
    if (year < 100) year += 2000;
  } else {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  let hours = 12;
  let minutes = 0;
  const time = /^(\d{1,2})(?::(\d{2}))?\s*([ap])?/i.exec(timeText);
  if (time) {
    const parsedHours = Number(time[1]);
    const parsedMinutes = Number(time[2] ?? "0");
    const meridiem = time[3]?.toLowerCase();
    if (parsedHours <= 23 && parsedMinutes <= 59 && (!meridiem || (parsedHours >= 1 && parsedHours <= 12))) {
      hours = meridiem ? (parsedHours % 12) + (meridiem === "p" ? 12 : 0) : parsedHours;
      minutes = parsedMinutes;
    }
  }

  const wallClockAsUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  try {
    return new Date(wallClockAsUtc.getTime() - timeZoneOffsetMs(wallClockAsUtc, timeZone));
  } catch {
    return wallClockAsUtc; // unknown timezone id: treat as UTC
  }
}

/**
 * Maps the sheet's Status / Site visit / Yes-No columns to a pipeline stage.
 * The most advanced signal wins.
 */
export function deriveSheetStage(
  status: string,
  siteVisit: string,
  qualification: string,
): { stage: LeadStage; lostReason: string | null } {
  const s = normalizeText(status);
  const visit = normalizeText(siteVisit);
  const q = normalizeText(qualification);

  if (/\b(closed won|won|sold)\b|تعاقد|تم البيع/.test(s)) return { stage: "WON", lostReason: null };
  if (/\b(lost|closed lost|not interested|cancel(l?ed)?)\b|غير مهتم|ملغي/.test(s)) {
    return { stage: "LOST", lostReason: clean(status) };
  }
  if (/^(not qualified|unqualified|no)$|غير مؤهل/.test(q)) return { stage: "LOST", lostReason: "Not qualified" };
  if (/reserv|حجز/.test(s)) return { stage: "RESERVATION", lostReason: null };
  if (/negotiat|تفاوض/.test(s)) return { stage: "NEGOTIATION", lostReason: null };
  if (visit && !/^(no|none|cancel|لا)/.test(visit)) return { stage: "VIEWING", lostReason: null };
  if (/^(qualified|yes)$|^مؤهل|^نعم/.test(q)) return { stage: "QUALIFIED", lostReason: null };
  if (/follow|contacted|متابع|تم التواصل/.test(s)) return { stage: "CONTACTED", lostReason: null };
  return { stage: "NEW", lostReason: null };
}

function matchKeyword<T>(text: string, table: ReadonlyArray<[T, RegExp]>): T | null {
  if (!text) return null;
  return table.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

/** Plain String columns are VARCHAR(191) on MySQL; longer values fail the whole sync. */
const VARCHAR_MAX = 191;

function splitName(raw: string): { firstName: string | null; lastName: string } {
  const name = raw.replace(/^[~\s]+/, "").replace(/\s+/g, " ").trim();
  if (!name || UNKNOWN_NAMES.has(name.toLowerCase())) return { firstName: null, lastName: "" };
  const [firstName, ...rest] = name.split(" ");
  return { firstName: firstName.slice(0, VARCHAR_MAX), lastName: rest.join(" ").slice(0, VARCHAR_MAX) };
}

function hashOf(values: unknown): string {
  return createHash("sha256").update(JSON.stringify([MAPPING_VERSION, values])).digest("hex").slice(0, 32);
}

export function mapSheetRow(
  cells: string[],
  columns: SheetColumns,
  options: { spreadsheetId: string; tab: SheetTab; rowNumber: number; timeZone: string },
): SheetLead | null {
  const cell = (field: SheetField) => {
    const index = columns.fields[field];
    return index === undefined ? "" : clean(cells[index]);
  };

  const rawName = cell("name");
  const rawPhone = cell("phone");
  const rawEmail = cell("email");
  if (!rawName && !rawPhone && !rawEmail) return null;

  const phone = normalizeSheetPhone(rawPhone);
  const email =
    rawEmail.length <= VARCHAR_MAX && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail.toLowerCase() : null;
  const rowKey = `gsheet:${options.spreadsheetId}:${options.tab.gid ?? "0"}:row:${cell("serial") || options.rowNumber}`;
  const { stage, lostReason } = deriveSheetStage(cell("status"), cell("siteVisit"), cell("qualification"));

  const details: [string, string][] = [
    ["Project", cell("project")],
    ["Preferred area", cell("area")],
    ["Unit size", cell("unitSize")],
    ["Payment plan", cell("paymentPlan")],
    ["Sales consultant", cell("consultant")],
    ["Source", cell("source")],
    ["Status", cell("status")],
    ["Site visit", cell("siteVisit")],
    ["Qualification", cell("qualification")],
    ["Job title", cell("jobTitle")],
    ["Contact time", cell("contactTime")],
    ["Phone (as written)", phone || rawPhone.length < 3 ? "" : rawPhone],
    ["Email (as written)", email || !rawEmail ? "" : rawEmail],
  ];
  const detailBlock = details
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");

  const knownIndexes = [
    ...Object.values(columns.fields),
    ...columns.feedback.map((entry) => entry.index),
  ];

  return {
    key: phone ? `gsheet:phone:${phone}` : rowKey,
    rowKey,
    hash: hashOf(knownIndexes.map((index) => clean(cells[index]))),
    tabName: options.tab.name,
    rowNumber: options.rowNumber,
    ...splitName(rawName),
    phone,
    email,
    createdAt: parseSheetDateTime(cell("date"), cell("contactTime"), options.timeZone),
    stage,
    lostReason,
    source: cell("source") ? (matchKeyword(cell("source"), SOURCE_KEYWORDS) ?? "OTHER") : null,
    propertyType:
      matchKeyword(cell("area"), PROPERTY_TYPE_KEYWORDS) ?? matchKeyword(cell("unitSize"), PROPERTY_TYPE_KEYWORDS),
    projectName: cell("project") || null,
    consultantName: cell("consultant") || null,
    notes: [detailBlock, cell("notes")].filter(Boolean).join("\n\n") || null,
    feedback: columns.feedback
      .map(({ label, index }) => ({ label, body: clean(cells[index]) }))
      .filter((entry) => entry.body),
  };
}

/**
 * The same person can appear on several rows (e.g. in two monthly tabs):
 * later rows win for single values, and every row's feedback is kept.
 */
export function mergeSheetLeads(leads: SheetLead[]): SheetLead[] {
  const groups = new Map<string, SheetLead[]>();
  for (const lead of leads) {
    groups.set(lead.key, [...(groups.get(lead.key) ?? []), lead]);
  }
  return [...groups.values()].map((group) => {
    if (group.length === 1) return group[0];
    const last = group[group.length - 1];
    const latest = [...group].reverse();
    const pick = <K extends keyof SheetLead>(field: K) => latest.find((entry) => entry[field])?.[field] ?? last[field];
    const named = latest.find((entry) => entry.firstName) ?? last;
    return {
      ...last,
      firstName: named.firstName,
      lastName: named.lastName,
      email: pick("email"),
      source: pick("source"),
      propertyType: pick("propertyType"),
      projectName: pick("projectName"),
      consultantName: pick("consultantName"),
      createdAt: group.find((entry) => entry.createdAt)?.createdAt ?? null,
      hash: hashOf(group.map((entry) => entry.hash)),
      notes: group.map((entry) => entry.notes).filter(Boolean).join("\n\n---\n\n") || null,
      feedback: group.flatMap((entry) =>
        entry.feedback.map((item) => ({ ...item, label: `${item.label} · ${entry.tabName} row ${entry.rowNumber}` })),
      ),
    };
  });
}

/** Open leads only move forward; WON/LOST set in the CRM are never reopened by the sheet. */
function nextStage(current: LeadStage, fromSheet: LeadStage): LeadStage {
  if (current === "WON" || current === "LOST") return current;
  if (fromSheet === "WON" || fromSheet === "LOST") return fromSheet;
  return LEAD_STAGES.indexOf(fromSheet) > LEAD_STAGES.indexOf(current) ? fromSheet : current;
}

function reachedQualified(stage: LeadStage): boolean {
  return stage !== "LOST" && LEAD_STAGES.indexOf(stage) >= LEAD_STAGES.indexOf("QUALIFIED");
}

export async function readSheetLeads(sheetUrl: string, timeZone: string): Promise<{ tabs: string[]; leads: SheetLead[] }> {
  const spreadsheetId = parseSpreadsheetId(sheetUrl);
  if (!spreadsheetId) {
    throw new AppError("That is not a Google Sheets link.", { code: "sheet_invalid_url", status: 422 });
  }

  const tabs: string[] = [];
  const leads: SheetLead[] = [];
  for (const tab of await listSheetTabs(spreadsheetId)) {
    const rows = parseCsv(await fetchSheetCsv(spreadsheetId, tab.gid));
    const detected = detectSheetColumns(rows);
    if (!detected) continue;
    tabs.push(tab.name);
    rows.slice(detected.headerRow + 1).forEach((cells, offset) => {
      const lead = mapSheetRow(cells, detected.columns, {
        spreadsheetId,
        tab,
        rowNumber: detected.headerRow + offset + 2,
        timeZone,
      });
      if (lead) leads.push(lead);
    });
  }

  if (tabs.length === 0) {
    throw new AppError(
      'No lead tab found in this sheet. A lead tab needs a header row with a name column ("New lead") and a "Phone" column.',
      { code: "sheet_no_leads", status: 422 },
    );
  }
  return { tabs, leads: mergeSheetLeads(leads) };
}

export async function syncLeadsFromSheet(input: {
  db: TenantScopedClient;
  organizationId: string;
  userId: string | null;
  sheetUrl: string;
  timeZone: string;
}): Promise<SheetSyncSummary> {
  const { db, organizationId } = input;
  const { tabs, leads } = await readSheetLeads(input.sheetUrl, input.timeZone);

  const refs = [...new Set(leads.flatMap((lead) => [lead.key, lead.rowKey]))];
  const phones = [...new Set(leads.flatMap((lead) => (lead.phone ? [lead.phone] : [])))];
  const leadSelect = {
    id: true,
    stage: true,
    notes: true,
    phone: true,
    createdAt: true,
    externalRef: true,
    externalHash: true,
    assignedToId: true,
    preferredProjectId: true,
    qualifiedAt: true,
    wonAt: true,
  } as const;

  const [linked, unlinked, projects, memberships] = await Promise.all([
    db.lead.findMany({ where: { externalRef: { in: refs } }, select: leadSelect }),
    db.lead.findMany({ where: { externalRef: null, phone: { in: phones } }, select: leadSelect }),
    db.project.findMany({ select: { id: true, name: true } }),
    db.membership.findMany({
      where: { status: "ACTIVE" },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const byRef = new Map(linked.map((lead) => [lead.externalRef, lead]));
  const byPhone = new Map(unlinked.map((lead) => [lead.phone, lead]));
  const users = memberships.map((membership) => membership.user);

  const unmatchedConsultants = new Set<string>();
  const unmatchedProjects = new Set<string>();

  const resolveUser = (name: string | null): string | null => {
    if (!name) return null;
    const target = normalizeText(name);
    const matches = users.filter((user) => {
      const full = normalizeText(user.name);
      return full === target || full.split(" ")[0] === target || normalizeText(user.email.split("@")[0]) === target;
    });
    if (matches.length === 1) return matches[0].id;
    unmatchedConsultants.add(name);
    return null;
  };

  const resolveProject = (name: string | null): string | null => {
    if (!name) return null;
    const id = matchProjectName(name, projects);
    if (!id) unmatchedProjects.add(name);
    return id ?? null;
  };

  const summary: SheetSyncSummary = {
    tabs,
    created: 0,
    updated: 0,
    unchanged: 0,
    unmatchedConsultants: [],
    unmatchedProjects: [],
  };
  const now = new Date();

  for (const row of leads) {
    const existing =
      byRef.get(row.key) ?? byRef.get(row.rowKey) ?? (row.phone ? byPhone.get(row.phone) : undefined);
    const assignedToId = resolveUser(row.consultantName);
    const preferredProjectId = resolveProject(row.projectName);

    if (existing?.externalRef === row.key && existing.externalHash === row.hash) {
      // The row is unchanged, but a consultant or project added in the ERP since
      // the last sync can now be linked. Links set by hand are left alone.
      const links = {
        ...(assignedToId && !existing.assignedToId ? { assignedToId } : {}),
        ...(preferredProjectId && !existing.preferredProjectId ? { preferredProjectId } : {}),
      };
      if (Object.keys(links).length > 0) {
        await db.lead.update({ where: { id: existing.id }, data: links });
        summary.updated++;
      } else {
        summary.unchanged++;
      }
      continue;
    }

    const feedbackActivities = (leadId: string, base: Date) =>
      row.feedback.map((entry, index) => ({
        organizationId,
        leadId,
        type: "NOTE" as const,
        subject: entry.label,
        body: entry.body,
        metadata: { source: ACTIVITY_SOURCE, field: entry.label },
        occurredAt: new Date(base.getTime() + index * 1000),
      }));

    if (!existing) {
      const createdAt = row.createdAt ?? now;
      await db.$transaction(async (tx) => {
        const lead = await tx.lead.create({
          data: {
            organizationId,
            firstName: row.firstName ?? "Unknown",
            lastName: row.lastName,
            phone: row.phone ?? "",
            email: row.email,
            source: row.source ?? "OTHER",
            stage: row.stage,
            lostReason: row.lostReason,
            propertyType: row.propertyType,
            preferredProjectId,
            assignedToId,
            notes: row.notes,
            qualifiedAt: reachedQualified(row.stage) ? createdAt : null,
            wonAt: row.stage === "WON" ? createdAt : null,
            lastActivityAt: createdAt,
            externalRef: row.key,
            externalHash: row.hash,
            createdById: input.userId,
            createdAt,
          },
        });
        await tx.leadActivity.createMany({
          data: [
            {
              organizationId,
              leadId: lead.id,
              userId: input.userId,
              type: "SYSTEM",
              subject: "Lead imported from Google Sheet",
              body: `${row.tabName} · row ${row.rowNumber}`,
              metadata: { source: ACTIVITY_SOURCE, tab: row.tabName, row: row.rowNumber },
              occurredAt: createdAt,
            },
            ...feedbackActivities(lead.id, createdAt),
          ],
        });
      });
      summary.created++;
      continue;
    }

    const stage = nextStage(existing.stage, row.stage);
    const stageChanged = stage !== existing.stage;
    await db.$transaction(async (tx) => {
      // A lead created by hand and matched by phone keeps its earlier notes as a timeline entry.
      if (!existing.externalRef && existing.notes?.trim()) {
        await tx.leadActivity.create({
          data: {
            organizationId,
            leadId: existing.id,
            type: "NOTE",
            subject: "Notes before Google Sheet link",
            body: existing.notes,
          },
        });
      }
      await tx.lead.update({
        where: { id: existing.id },
        data: {
          ...(row.firstName ? { firstName: row.firstName, lastName: row.lastName } : {}),
          ...(row.phone ? { phone: row.phone } : {}),
          ...(row.email ? { email: row.email } : {}),
          ...(row.source ? { source: row.source } : {}),
          ...(row.propertyType ? { propertyType: row.propertyType } : {}),
          ...(preferredProjectId ? { preferredProjectId } : {}),
          ...(assignedToId ? { assignedToId } : {}),
          notes: row.notes,
          stage,
          ...(stageChanged
            ? {
                lostReason: stage === "LOST" ? row.lostReason : null,
                qualifiedAt: existing.qualifiedAt ?? (reachedQualified(stage) ? now : null),
                wonAt: existing.wonAt ?? (stage === "WON" ? now : null),
                lastActivityAt: now,
              }
            : {}),
          externalRef: row.key,
          externalHash: row.hash,
        },
      });
      // Feedback columns are owned by the sheet: replace the previous copies.
      await tx.leadActivity.deleteMany({
        where: { leadId: existing.id, type: "NOTE", metadata: { path: "$.source", equals: ACTIVITY_SOURCE } },
      });
      await tx.leadActivity.createMany({
        data: [
          ...feedbackActivities(existing.id, row.createdAt ?? existing.createdAt),
          ...(stageChanged
            ? [
                {
                  organizationId,
                  leadId: existing.id,
                  userId: input.userId,
                  type: "STAGE_CHANGE" as const,
                  subject: `Stage moved from ${existing.stage} to ${stage} (Google Sheet)`,
                },
              ]
            : []),
        ],
      });
    });
    summary.updated++;
  }

  summary.unmatchedConsultants = [...unmatchedConsultants];
  summary.unmatchedProjects = [...unmatchedProjects];
  return summary;
}
