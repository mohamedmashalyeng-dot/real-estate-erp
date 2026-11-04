import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { testDatabaseUrl } from "../scripts/lib/dev-db-config";
import { parseCsv } from "@/lib/google-sheets";
import { calculatePaymentPlan, scheduleInstallments, type CalculatorInput } from "@/lib/payment-calculator";
import { parsePricingSheet, parseSheetNumber } from "@/lib/pricing-sheet";
import type { OrganizationContext } from "@/lib/context";

const mocked = vi.hoisted(() => ({ context: null as OrganizationContext | null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/context", () => ({ requirePermission: vi.fn(async () => mocked.context) }));

// The Prisma client reads DATABASE_URL when it is first imported.
process.env.DATABASE_URL = testDatabaseUrl();
const { prisma, forOrganization } = await import("@/lib/prisma");
const { savePaymentPlanAction } = await import("@/app/(dashboard)/sales/calculator/actions");

/** Default inputs of the "WEST Sales Payment Calculator" workbook. */
const WEST_SETTINGS: Omit<CalculatorInput, "totalPrice"> = {
  contract: { mode: "PERCENT", value: 5 },
  downPayment: { mode: "PERCENT", value: 15 },
  annualRatePercent: 10,
  annualTiming: "START",
  frequency: "MONTHLY",
  termMonths: 100,
  handoverMonth: 36,
  targetPercent: 60,
};
const WEST: CalculatorInput = { ...WEST_SETTINGS, totalPrice: 168 * 25_000 + 200_000 };

const round = (value: number) => Math.round(value * 100) / 100;

describe("calculatePaymentPlan", () => {
  it("reproduces the workbook's numbers", () => {
    const result = calculatePaymentPlan(WEST);
    expect(result.totalPrice).toBe(4_400_000);
    expect(result.contractAmount).toBe(220_000);
    expect(result.downPaymentAmount).toBe(627_000);
    expect(result.financedBalance).toBe(3_553_000);
    expect(round(result.monthlyInstallment)).toBe(26_835.24);
    expect(result.years.map((year) => [round(year.annualPayment), round(year.totalPaid)])).toEqual([
      [355_300, 677_322.83],
      [287_567.72, 609_590.55],
      [226_608.66, 548_631.5],
    ]);
    expect(round(result.handover.paidAmount)).toBe(2_682_544.88);
    expect(round(result.handover.paidPercent)).toBe(60.97);
    expect(round(result.handover.remainingBalance)).toBe(1_717_455.12);
    expect(result.handover.status).toBe("SAFE");
    expect(result.afterHandover).toMatchObject({ monthsRemaining: 64, monthlyCount: 64 });
    expect(result.timeline).toHaveLength(100);
    expect(result.timeline.at(-1)!.closingBalance).toBeCloseTo(0, 6);
  });

  it("supports quarterly installments with a final partial period", () => {
    const result = calculatePaymentPlan({ ...WEST, frequency: "QUARTERLY" });
    expect(round(result.quarterlyInstallment)).toBe(80_505.71);
    expect(result.afterHandover).toMatchObject({ quarterlyCount: 21, partialMonths: 1 });
    expect(result.timeline.filter((row) => row.installmentUnits > 0).at(-1)).toMatchObject({ month: 100, installmentUnits: 1 });
    expect(result.timeline.at(-1)!.closingBalance).toBeCloseTo(0, 6);
  });

  it("places annual dues at the end of each year when asked", () => {
    const result = calculatePaymentPlan({ ...WEST, annualTiming: "END" });
    expect(result.timeline.filter((row) => row.annualDue > 0).map((row) => row.month)).toEqual([12, 24, 36]);
  });

  it("flags plans that miss the handover target or make no sense", () => {
    expect(calculatePaymentPlan({ ...WEST, targetPercent: 65 }).handover.status).toBe("OUTSIDE");
    expect(calculatePaymentPlan({ ...WEST, totalPrice: 0 }).handover.status).toBe("INVALID");
    expect(calculatePaymentPlan({ ...WEST, downPayment: { mode: "AMOUNT", value: 9_000_000 } }).handover.status).toBe("INVALID");
  });

  it("schedules dated installments that add up to the financed balance", () => {
    const result = calculatePaymentPlan(WEST);
    const schedule = scheduleInstallments(result, new Date("2027-01-31T00:00:00.000Z"));
    expect(schedule).toHaveLength(100);
    expect(schedule.reduce((sum, entry) => sum + Math.round(entry.amount * 100), 0)).toBe(355_300_000);
    expect(schedule[0]).toMatchObject({ sequence: 1, amount: 382_135.24 });
    expect(schedule[0].dueDate.toISOString()).toBe("2027-02-28T00:00:00.000Z");
    expect(schedule[1].dueDate.toISOString()).toBe("2027-03-31T00:00:00.000Z");
    expect(schedule[99].dueDate.toISOString()).toBe("2035-05-31T00:00:00.000Z");
  });
});

describe("pricing sheet", () => {
  // Calculator tab as Google exports it for an Arabic-locale file.
  const CSV = [
    "WEST Development | Sales Payment Calculator,,,,,,",
    "1. UNIT PRICE,,,,,,",
    'Unit area (m²),168٫00,"Choose 168, 170, or 180",,,,',
    "Price per m² (EGP),25٬000٫00,168 m² = 25٬000; 170/180 m² = 24٬000 assumed,,,,",
    "Elevator + garage (EGP),200٬000٫00,Added to unit price,,,,",
    "TOTAL UNIT PRICE (EGP),4٬400٬000٫00,Used in all calculations,,,,",
    "Payment component,Entry mode,Input value,Equivalent %,Applied amount (EGP),Calculation base,",
    "Contract payment,Percent,5٫00,5٫00%,220٬000٫00,% of total unit price,",
    "Down payment,EGP,600000,14٫35%,600٬000٫00,% of price after contract payment,",
    "Annual payment rate (%),10٫00%,Each annual payment is a % of opening balance at its due date,,,,",
    'Annual payment timing,End of year,"Start = months 1, 13, 25; End = months 12, 24, 36",,,,',
    "Installment frequency,Quarterly,Choose Monthly or Quarterly,,,,",
    "Total installment term (months),100,Total term starts from contract date,,,,",
    "Handover month,36,Handover after 3 years,,,,",
    'Minimum collection target (%),60%,"Choose 60%, 55%, or 50%",,,,',
  ].join("\n");

  it("parses numbers in Arabic and Western formats", () => {
    expect(parseSheetNumber("25٬000٫00")).toBe(25_000);
    expect(parseSheetNumber("4,400,000.00")).toBe(4_400_000);
    expect(parseSheetNumber("١٠%")).toBe(10);
    expect(parseSheetNumber("EGP 200,000")).toBe(200_000);
    expect(parseSheetNumber("")).toBeNull();
  });

  it("reads prices and plan defaults by row label", () => {
    expect(parsePricingSheet(parseCsv(CSV))).toEqual({
      title: "WEST Development | Sales Payment Calculator",
      areaOptions: [
        { areaSqm: 168, pricePerSqm: 25_000 },
        { areaSqm: 170, pricePerSqm: 24_000 },
        { areaSqm: 180, pricePerSqm: 24_000 },
      ],
      extras: [{ label: "Elevator + garage (EGP)", amount: 200_000 }],
      priceNote: "168 m² = 25٬000; 170/180 m² = 24٬000 assumed",
      contract: { mode: "PERCENT", value: 5 },
      downPayment: { mode: "AMOUNT", value: 600_000 },
      annualRatePercent: 10,
      annualTiming: "END",
      frequency: "QUARTERLY",
      termMonths: 100,
      handoverMonth: 36,
      targetPercent: 60,
      targetOptions: [60, 55, 50],
    });
  });

  it("names the rows it could not find", () => {
    expect(() => parsePricingSheet(parseCsv("Unit area (m²),168\nHandover month,36"))).toThrow(/Price per m².*Contract payment/);
  });
});

describe("savePaymentPlanAction", () => {
  const suffix = Date.now().toString(36);
  let organizationId: string;
  let saleId: string;
  const saleDate = new Date("2027-01-15T10:00:00.000Z");

  beforeAll(async () => {
    const organization = await prisma.organization.create({
      data: { name: `Plan ${suffix}`, slug: `plan-${suffix}` },
    });
    organizationId = organization.id;
    const user = await prisma.user.create({
      data: { name: "Finance User", email: `finance-${suffix}@example.test`, passwordHash: "x" },
    });
    const project = await prisma.project.create({ data: { organizationId, name: "WEST" } });
    const unit = await prisma.unit.create({
      data: { organizationId, projectId: project.id, unitCode: "W-168", type: "APARTMENT", areaSqm: "168", price: "4400000" },
    });
    const lead = await prisma.lead.create({ data: { organizationId, firstName: "Sara", lastName: "Ali", phone: "+201000000000" } });
    const sale = await prisma.sale.create({
      data: {
        organizationId,
        reference: `S-${suffix}`,
        leadId: lead.id,
        unitId: unit.id,
        salespersonId: user.id,
        salePrice: "4400000",
        contractValue: "4400000",
        saleDate,
      },
    });
    saleId = sale.id;

    mocked.context = {
      user: { id: user.id, name: user.name, email: user.email, image: null, jobTitle: null, isPlatformAdmin: false },
      organizationId,
      currency: "EGP",
      permissions: ["payments.manage"],
      db: forOrganization(organizationId),
    } as unknown as OrganizationContext;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@example.test` } } });
    await prisma.$disconnect();
  });

  it("saves the schedule from the sale's contract value", async () => {
    const result = await savePaymentPlanAction(saleId, WEST_SETTINGS);
    expect(result).toMatchObject({ ok: true, data: { installments: 100 } });

    const plan = await prisma.paymentPlan.findUniqueOrThrow({
      where: { saleId },
      include: { installments: { orderBy: { sequence: "asc" } } },
    });
    expect(plan.totalAmount.toString()).toBe("4400000");
    expect(plan.downPayment.toString()).toBe("847000");
    expect(plan.installmentsCount).toBe(100);
    expect(plan.installments[0].amount.toString()).toBe("382135.24");
    expect(plan.installments[0].dueDate.toISOString()).toBe("2027-02-15T10:00:00.000Z");
    const total = plan.installments.reduce((sum, installment) => sum + Math.round(Number(installment.amount) * 100), 0);
    expect(total).toBe(355_300_000);
  });

  it("replaces an unpaid plan and refuses once installments are paid", async () => {
    const replaced = await savePaymentPlanAction(saleId, { ...WEST_SETTINGS, frequency: "QUARTERLY" });
    expect(replaced.ok).toBe(true);
    const plan = await prisma.paymentPlan.findUniqueOrThrow({ where: { saleId }, include: { installments: true } });
    expect(plan.installments).toHaveLength(plan.installmentsCount);
    expect(plan.installmentsCount).toBeLessThan(100);

    await prisma.installment.updateMany({ where: { paymentPlanId: plan.id, sequence: 1 }, data: { paidAmount: "1000" } });
    const refused = await savePaymentPlanAction(saleId, WEST_SETTINGS);
    expect(refused).toMatchObject({ ok: false, code: "conflict" });
  });

  it("rejects invalid settings before touching the database", async () => {
    const result = await savePaymentPlanAction(saleId, { ...WEST_SETTINGS, handoverMonth: 120 });
    expect(result).toMatchObject({ ok: false, code: "validation_error" });
  });
});
