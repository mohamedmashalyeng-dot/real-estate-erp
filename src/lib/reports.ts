import type { LeadSource, LeadStage } from "@/generated/prisma/enums";
import { fromCents, toCents } from "./collections";
import type { TenantScopedClient } from "./prisma";

/**
 * Management reports: sales by salesperson, lead sources, campaign ROI,
 * pipeline funnel and monthly collections, for a date range.
 */

export interface ReportRange {
  from: Date;
  /** Exclusive upper bound. */
  to: Date;
}

const CLOSED_SALE_STATUSES = ["APPROVED", "CONTRACTED", "COMPLETED"] as const;
const FUNNEL_STAGES: LeadStage[] = ["NEW", "CONTACTED", "QUALIFIED", "VIEWING", "NEGOTIATION", "RESERVATION", "WON", "LOST"];

function parseDay(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Range from `?from=YYYY-MM-DD&to=YYYY-MM-DD` (both inclusive); defaults to the last 6 months. */
export function resolveRange(params: { from?: string; to?: string }, now: Date = new Date()): ReportRange & { fromDay: string; toDay: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let toDay = parseDay(params.to) ?? today;
  let fromDay = parseDay(params.from) ?? new Date(today.getFullYear(), today.getMonth() - 5, 1);
  if (fromDay > toDay) [fromDay, toDay] = [toDay, fromDay];
  const to = new Date(toDay.getFullYear(), toDay.getMonth(), toDay.getDate() + 1);
  return { from: fromDay, to, fromDay: formatDay(fromDay), toDay: formatDay(toDay) };
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Every month touched by the range, oldest first. */
export function monthsInRange(range: ReportRange): string[] {
  const keys: string[] = [];
  const cursor = new Date(range.from.getFullYear(), range.from.getMonth(), 1);
  while (cursor < range.to) {
    keys.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

export interface MonthlyCollection {
  month: string;
  dueAmount: string;
  collectedAmount: string;
  /** Collected ÷ due, as a percentage; null when nothing was due. */
  ratePercent: number | null;
}

export function collectionsByMonth(
  range: ReportRange,
  installments: { dueDate: Date; amount: { toString(): string } }[],
  payments: { paidAt: Date; amount: { toString(): string } }[],
): MonthlyCollection[] {
  const due = new Map<string, number>();
  const collected = new Map<string, number>();
  for (const row of installments) due.set(monthKey(row.dueDate), (due.get(monthKey(row.dueDate)) ?? 0) + toCents(row.amount));
  for (const row of payments) collected.set(monthKey(row.paidAt), (collected.get(monthKey(row.paidAt)) ?? 0) + toCents(row.amount));
  return monthsInRange(range).map((month) => {
    const dueCents = due.get(month) ?? 0;
    const collectedCents = collected.get(month) ?? 0;
    return {
      month,
      dueAmount: fromCents(dueCents),
      collectedAmount: fromCents(collectedCents),
      ratePercent: dueCents > 0 ? (collectedCents / dueCents) * 100 : null,
    };
  });
}

export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

export interface SalespersonRow {
  salespersonId: string;
  name: string;
  leadsAssigned: number;
  salesCount: number;
  salesValue: string;
  collected: string;
}

export interface SourceRow {
  source: LeadSource;
  leads: number;
  qualified: number;
  won: number;
  conversionPercent: number | null;
}

export interface CampaignRow {
  id: string;
  name: string;
  platform: string;
  status: string;
  cost: string;
  currency: string;
  leads: number;
  won: number;
  salesValue: string;
  costPerLead: string | null;
  costPerSale: string | null;
  /** Sales value ÷ cost. */
  roiMultiple: number | null;
}

export interface ReportData {
  range: ReportRange;
  totals: {
    leads: number;
    won: number;
    salesCount: number;
    salesValue: string;
    collected: string;
    due: string;
    /** Paid share of installments in the range whose due date has passed. */
    collectionRatePercent: number | null;
  };
  funnel: { stage: LeadStage; count: number }[];
  salespeople: SalespersonRow[];
  sources: SourceRow[];
  campaigns: CampaignRow[];
  collections: MonthlyCollection[];
}

const QUALIFIED_STAGES: LeadStage[] = ["QUALIFIED", "VIEWING", "NEGOTIATION", "RESERVATION", "WON"];

export async function buildReport(db: TenantScopedClient, range: ReportRange, now: Date = new Date()): Promise<ReportData> {
  const inRange = { gte: range.from, lt: range.to };

  const [leadsByStage, leadsBySourceStage, leadsByOwner, sales, payments, installments, campaigns, campaignLeads] = await Promise.all([
    db.lead.groupBy({ by: ["stage"], where: { createdAt: inRange }, _count: { _all: true } }),
    db.lead.groupBy({ by: ["source", "stage"], where: { createdAt: inRange }, _count: { _all: true } }),
    db.lead.groupBy({ by: ["assignedToId"], where: { createdAt: inRange, assignedToId: { not: null } }, _count: { _all: true } }),
    db.sale.findMany({
      where: { saleDate: inRange, status: { in: [...CLOSED_SALE_STATUSES] } },
      select: { salespersonId: true, contractValue: true, lead: { select: { campaignId: true } } },
    }),
    db.payment.findMany({ where: { paidAt: inRange }, select: { paidAt: true, amount: true, sale: { select: { salespersonId: true } } } }),
    db.installment.findMany({ where: { dueDate: inRange }, select: { dueDate: true, amount: true, paidAmount: true } }),
    db.campaign.findMany({
      where: { startDate: { lt: range.to }, OR: [{ endDate: null }, { endDate: { gte: range.from } }] },
      orderBy: { startDate: "desc" },
    }),
    db.lead.groupBy({ by: ["campaignId", "stage"], where: { campaignId: { not: null } }, _count: { _all: true } }),
  ]);

  // Funnel
  const stageCounts = new Map(leadsByStage.map((row) => [row.stage, row._count._all]));
  const funnel = FUNNEL_STAGES.map((stage) => ({ stage, count: stageCounts.get(stage) ?? 0 }));
  const totalLeads = funnel.reduce((sum, row) => sum + row.count, 0);

  // Sources
  const sourceMap = new Map<LeadSource, SourceRow>();
  for (const row of leadsBySourceStage) {
    const entry = sourceMap.get(row.source) ?? { source: row.source, leads: 0, qualified: 0, won: 0, conversionPercent: null };
    entry.leads += row._count._all;
    if (QUALIFIED_STAGES.includes(row.stage)) entry.qualified += row._count._all;
    if (row.stage === "WON") entry.won += row._count._all;
    sourceMap.set(row.source, entry);
  }
  const sources = [...sourceMap.values()]
    .map((row) => ({ ...row, conversionPercent: ratio(row.won, row.leads) }))
    .sort((a, b) => b.leads - a.leads);

  // Salespeople
  const people = new Map<string, { leads: number; count: number; valueCents: number; collectedCents: number }>();
  const person = (id: string) => {
    const existing = people.get(id);
    if (existing) return existing;
    const created = { leads: 0, count: 0, valueCents: 0, collectedCents: 0 };
    people.set(id, created);
    return created;
  };
  for (const row of leadsByOwner) if (row.assignedToId) person(row.assignedToId).leads += row._count._all;
  for (const sale of sales) {
    const entry = person(sale.salespersonId);
    entry.count += 1;
    entry.valueCents += toCents(sale.contractValue);
  }
  for (const payment of payments) person(payment.sale.salespersonId).collectedCents += toCents(payment.amount);
  const users = people.size
    ? await db.user.findMany({ where: { id: { in: [...people.keys()] } }, select: { id: true, name: true } })
    : [];
  const names = new Map(users.map((user) => [user.id, user.name]));
  const salespeople = [...people.entries()]
    .map(([id, value]) => ({
      salespersonId: id,
      name: names.get(id) ?? "Unknown",
      leadsAssigned: value.leads,
      salesCount: value.count,
      salesValue: fromCents(value.valueCents),
      collected: fromCents(value.collectedCents),
    }))
    .sort((a, b) => toCents(b.salesValue) - toCents(a.salesValue) || b.leadsAssigned - a.leadsAssigned);

  // Campaigns (lifetime leads per campaign; sales in range)
  const campaignStats = new Map<string, { leads: number; won: number; salesCents: number }>();
  const campaignEntry = (id: string) => {
    const existing = campaignStats.get(id);
    if (existing) return existing;
    const created = { leads: 0, won: 0, salesCents: 0 };
    campaignStats.set(id, created);
    return created;
  };
  for (const row of campaignLeads) {
    if (!row.campaignId) continue;
    const entry = campaignEntry(row.campaignId);
    entry.leads += row._count._all;
    if (row.stage === "WON") entry.won += row._count._all;
  }
  for (const sale of sales) if (sale.lead.campaignId) campaignEntry(sale.lead.campaignId).salesCents += toCents(sale.contractValue);
  const campaignRows: CampaignRow[] = campaigns.map((campaign) => {
    const stats = campaignStats.get(campaign.id) ?? { leads: 0, won: 0, salesCents: 0 };
    const costCents = toCents(campaign.cost);
    return {
      id: campaign.id,
      name: campaign.name,
      platform: campaign.platform,
      status: campaign.status,
      cost: fromCents(costCents),
      currency: campaign.currency,
      leads: stats.leads,
      won: stats.won,
      salesValue: fromCents(stats.salesCents),
      costPerLead: stats.leads ? fromCents(Math.round(costCents / stats.leads)) : null,
      costPerSale: stats.won ? fromCents(Math.round(costCents / stats.won)) : null,
      roiMultiple: costCents > 0 ? stats.salesCents / costCents : null,
    };
  });

  const collections = collectionsByMonth(range, installments, payments);
  const pastDue = installments.filter((row) => row.dueDate <= now);
  const pastDueCents = pastDue.reduce((total, row) => total + toCents(row.amount), 0);
  const pastDuePaidCents = pastDue.reduce((total, row) => total + Math.min(toCents(row.paidAmount), toCents(row.amount)), 0);
  const sum = (values: string[]) => fromCents(values.reduce((total, value) => total + toCents(value), 0));

  return {
    range,
    totals: {
      leads: totalLeads,
      won: stageCounts.get("WON") ?? 0,
      salesCount: sales.length,
      salesValue: sum(sales.map((sale) => sale.contractValue.toString())),
      collected: sum(collections.map((row) => row.collectedAmount)),
      due: sum(collections.map((row) => row.dueAmount)),
      collectionRatePercent: ratio(pastDuePaidCents, pastDueCents),
    },
    funnel,
    salespeople,
    sources,
    campaigns: campaignRows,
    collections,
  };
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV with a UTF-8 BOM so Excel opens Arabic names correctly. */
export function toCsv(header: string[], rows: unknown[][]): string {
  return "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export const REPORT_EXPORTS = ["salespeople", "sources", "campaigns", "collections"] as const;
export type ReportExport = (typeof REPORT_EXPORTS)[number];

const pct = (value: number | null) => (value === null ? "" : value.toFixed(1));

export function reportCsv(report: ReportData, kind: ReportExport): string {
  switch (kind) {
    case "salespeople":
      return toCsv(
        ["Salesperson", "Leads assigned", "Sales", "Sales value", "Collected"],
        report.salespeople.map((row) => [row.name, row.leadsAssigned, row.salesCount, row.salesValue, row.collected]),
      );
    case "sources":
      return toCsv(
        ["Source", "Leads", "Qualified", "Won", "Conversion %"],
        report.sources.map((row) => [row.source, row.leads, row.qualified, row.won, pct(row.conversionPercent)]),
      );
    case "campaigns":
      return toCsv(
        ["Campaign", "Platform", "Status", "Cost", "Currency", "Leads", "Won", "Sales value", "Cost per lead", "Cost per sale", "ROI (x)"],
        report.campaigns.map((row) => [
          row.name, row.platform, row.status, row.cost, row.currency, row.leads, row.won, row.salesValue,
          row.costPerLead, row.costPerSale, row.roiMultiple === null ? "" : row.roiMultiple.toFixed(2),
        ]),
      );
    case "collections":
      return toCsv(
        ["Month", "Due", "Collected", "Collection rate %"],
        report.collections.map((row) => [row.month, row.dueAmount, row.collectedAmount, pct(row.ratePercent)]),
      );
  }
}
