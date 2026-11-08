import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDatabaseUrl } from "../scripts/lib/dev-db-config";
import {
  agingReport,
  allocatePayment,
  daysOverdue,
  deriveInstallmentStatus,
  remainingCents,
  syncInstallmentStatuses,
} from "@/lib/collections";
import { collectionsByMonth, monthsInRange, resolveRange, toCsv } from "@/lib/reports";

process.env.DATABASE_URL = testDatabaseUrl();
const { prisma, forOrganization } = await import("@/lib/prisma");
const { buildReport } = await import("@/lib/reports");

const NOW = new Date(2026, 10, 8, 14, 0); // 8 Nov 2026, 14:00
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe("installment status", () => {
  it("derives status from paid amount and due date", () => {
    expect(deriveInstallmentStatus({ amount: 1000, paidAmount: 1000, dueDate: day(2026, 1, 1) }, NOW)).toBe("PAID");
    expect(deriveInstallmentStatus({ amount: 1000, paidAmount: 400, dueDate: day(2026, 11, 7) }, NOW)).toBe("OVERDUE");
    expect(deriveInstallmentStatus({ amount: 1000, paidAmount: 0, dueDate: day(2026, 11, 8) }, NOW)).toBe("DUE");
    expect(deriveInstallmentStatus({ amount: 1000, paidAmount: 400, dueDate: day(2026, 12, 1) }, NOW)).toBe("PARTIALLY_PAID");
    expect(deriveInstallmentStatus({ amount: 1000, paidAmount: 0, dueDate: day(2026, 12, 1) }, NOW)).toBe("UPCOMING");
  });

  it("allocates partial and full payments without float drift", () => {
    const installment = { amount: "1000.10", paidAmount: "0", dueDate: day(2026, 12, 1) };
    const first = allocatePayment(installment, 0.1, NOW);
    expect(first).toEqual({ paidAmount: "0.10", status: "PARTIALLY_PAID", settled: false });
    const second = allocatePayment({ ...installment, paidAmount: first.paidAmount }, 1000, NOW);
    expect(second).toEqual({ paidAmount: "1000.10", status: "PAID", settled: true });
    expect(remainingCents({ amount: "1000.10", paidAmount: second.paidAmount })).toBe(0);
  });

  it("rejects zero, overpayments and payments on settled installments", () => {
    const installment = { amount: 500, paidAmount: 200, dueDate: day(2026, 12, 1) };
    expect(() => allocatePayment(installment, 0, NOW)).toThrow(/greater than zero/);
    expect(() => allocatePayment(installment, 300.01, NOW)).toThrow(/remaining balance of 300.00/);
    expect(() => allocatePayment({ ...installment, paidAmount: 500 }, 1, NOW)).toThrow(/already fully paid/);
  });

  it("buckets arrears by days late", () => {
    expect(daysOverdue(day(2026, 11, 1), NOW)).toBe(7);
    const { buckets, totalCents } = agingReport(
      [
        { amount: 100, paidAmount: 0, dueDate: day(2026, 11, 1) }, // 7 days
        { amount: 200, paidAmount: 50, dueDate: day(2026, 9, 20) }, // 49 days
        { amount: 300, paidAmount: 0, dueDate: day(2026, 6, 1) }, // 160 days
        { amount: 400, paidAmount: 400, dueDate: day(2026, 6, 1) }, // paid
        { amount: 500, paidAmount: 0, dueDate: day(2026, 11, 8) }, // due today, not late
      ],
      NOW,
    );
    expect(buckets.d0_30).toEqual({ count: 1, amount: "100.00" });
    expect(buckets.d31_60).toEqual({ count: 1, amount: "150.00" });
    expect(buckets.d61_90).toEqual({ count: 0, amount: "0.00" });
    expect(buckets.d90_plus).toEqual({ count: 1, amount: "300.00" });
    expect(totalCents).toBe(55000);
  });
});

describe("report helpers", () => {
  it("resolves inclusive day ranges and defaults to six months", () => {
    const range = resolveRange({ from: "2026-03-01", to: "2026-03-31" }, NOW);
    expect(range.from).toEqual(day(2026, 3, 1));
    expect(range.to).toEqual(day(2026, 4, 1));
    const fallback = resolveRange({ from: "garbage" }, NOW);
    expect(fallback.fromDay).toBe("2026-06-01");
    expect(fallback.toDay).toBe("2026-11-08");
    expect(resolveRange({ from: "2026-05-10", to: "2026-05-01" }, NOW).fromDay).toBe("2026-05-01");
  });

  it("groups due vs collected per month", () => {
    const range = resolveRange({ from: "2026-01-15", to: "2026-03-10" }, NOW);
    expect(monthsInRange(range)).toEqual(["2026-01", "2026-02", "2026-03"]);
    const rows = collectionsByMonth(
      range,
      [{ dueDate: day(2026, 1, 20), amount: "1000" }, { dueDate: day(2026, 2, 5), amount: "500" }],
      [{ paidAt: day(2026, 1, 21), amount: "800" }, { paidAt: day(2026, 3, 1), amount: "100" }],
    );
    expect(rows).toEqual([
      { month: "2026-01", dueAmount: "1000.00", collectedAmount: "800.00", ratePercent: 80 },
      { month: "2026-02", dueAmount: "500.00", collectedAmount: "0.00", ratePercent: 0 },
      { month: "2026-03", dueAmount: "0.00", collectedAmount: "100.00", ratePercent: null },
    ]);
  });

  it("writes Excel-friendly CSV", () => {
    expect(toCsv(["Name", "Note"], [["أحمد", 'says "hi", ok'], [null, 3]])).toBe(
      '﻿Name,Note\r\nأحمد,"says ""hi"", ok"\r\n,3\r\n',
    );
  });
});

describe("collections against the database", () => {
  const suffix = Date.now().toString(36);
  let organizationId = "";
  const installmentIds: string[] = [];

  beforeAll(async () => {
    const organization = await prisma.organization.create({
      data: { name: `Collections ${suffix}`, slug: `collections-${suffix}`, timezone: "Africa/Cairo" },
    });
    organizationId = organization.id;
    const db = forOrganization(organizationId);
    const user = await prisma.user.create({ data: { name: "Sara Sales", email: `sara-${suffix}@example.com`, passwordHash: "x" } });
    const campaign = await db.campaign.create({
      data: { organizationId, name: "Autumn FB", platform: "FACEBOOK", cost: "10000", startDate: day(2026, 9, 1) },
    });
    const lead = await db.lead.create({
      data: {
        organizationId, firstName: "Omar", lastName: "Ali", phone: "01000000000", source: "FACEBOOK",
        stage: "WON", campaignId: campaign.id, assignedToId: user.id, createdAt: day(2026, 9, 10),
      },
    });
    await db.lead.create({
      data: { organizationId, firstName: "Mona", lastName: "Z", phone: "01000000001", source: "FACEBOOK", campaignId: campaign.id, createdAt: day(2026, 9, 12) },
    });
    const project = await db.project.create({ data: { organizationId, name: "Test Towers", code: `TT-${suffix}` } });
    const unit = await db.unit.create({
      data: { organizationId, projectId: project.id, unitCode: "A-101", type: "APARTMENT", areaSqm: "120", price: "1000000" },
    });
    const sale = await db.sale.create({
      data: {
        organizationId, reference: `S-${suffix}`, leadId: lead.id, unitId: unit.id, salespersonId: user.id,
        salePrice: "1000000", contractValue: "1000000", saleDate: day(2026, 9, 15), status: "CONTRACTED",
      },
    });
    const plan = await db.paymentPlan.create({
      data: { organizationId, saleId: sale.id, totalAmount: "1000000", installmentsCount: 3, startDate: day(2026, 9, 15) },
    });
    const dueDates = [day(2026, 9, 15), day(2026, 11, 8), day(2027, 1, 15)];
    for (const [index, dueDate] of dueDates.entries()) {
      const row = await db.installment.create({
        data: { organizationId, paymentPlanId: plan.id, sequence: index + 1, amount: "100000", paidAmount: index === 0 ? "60000" : "0", dueDate, status: "UPCOMING" },
      });
      installmentIds.push(row.id);
    }
    await db.payment.create({
      data: { organizationId, saleId: sale.id, installmentId: installmentIds[0], amount: "60000", paidAt: day(2026, 9, 20) },
    });
  });

  afterAll(async () => {
    if (organizationId) {
      // Sales restrict deleting their lead/unit/salesperson, so remove them first.
      await prisma.sale.deleteMany({ where: { organizationId } });
      await prisma.organization.delete({ where: { id: organizationId } });
    }
    await prisma.user.deleteMany({ where: { email: `sara-${suffix}@example.com` } });
    await prisma.$disconnect();
  });

  it("moves past-due installments to OVERDUE / DUE and is idempotent", async () => {
    const db = forOrganization(organizationId);
    expect(await syncInstallmentStatuses(db, NOW)).toBe(2);
    const rows = await db.installment.findMany({ where: { id: { in: installmentIds } }, orderBy: { sequence: "asc" } });
    expect(rows.map((row) => row.status)).toEqual(["OVERDUE", "DUE", "UPCOMING"]);
    expect(await syncInstallmentStatuses(db, NOW)).toBe(0);
  });

  it("builds the management report", async () => {
    const db = forOrganization(organizationId);
    const report = await buildReport(db, resolveRange({ from: "2026-09-01", to: "2026-11-30" }, NOW), NOW);
    expect(report.totals).toMatchObject({ leads: 2, won: 1, salesCount: 1, salesValue: "1000000.00", collected: "60000.00", due: "200000.00", collectionRatePercent: 30 });
    expect(report.sources).toEqual([{ source: "FACEBOOK", leads: 2, qualified: 1, won: 1, conversionPercent: 50 }]);
    expect(report.salespeople).toEqual([
      { salespersonId: expect.any(String), name: "Sara Sales", leadsAssigned: 1, salesCount: 1, salesValue: "1000000.00", collected: "60000.00" },
    ]);
    expect(report.campaigns[0]).toMatchObject({ name: "Autumn FB", leads: 2, won: 1, costPerLead: "5000.00", costPerSale: "10000.00", roiMultiple: 100 });
    expect(report.collections.map((row) => row.month)).toEqual(["2026-09", "2026-10", "2026-11"]);
  });
});
