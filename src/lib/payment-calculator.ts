/**
 * Sales payment calculator: a port of the "WEST Sales Payment Calculator"
 * workbook (Calculator + Timeline tabs). Pure functions shared by the
 * calculator page (live preview) and the server action that saves a plan.
 *
 * Model, month by month over the term:
 *  - the contract payment and the down payment are paid at signing;
 *  - an annual payment of `annualRatePercent` of the opening balance is due
 *    at the start (months 1, 13, 25, ...) or end (12, 24, 36, ...) of every
 *    contract year up to the handover month;
 *  - a fixed monthly-equivalent installment runs in parallel for the whole
 *    term (quarterly mode pays three of them every third month);
 *  - the installment is solved so the balance clears exactly at the end.
 */

export type AmountMode = "PERCENT" | "AMOUNT";
export type AnnualTiming = "START" | "END";
export type InstallmentFrequency = "MONTHLY" | "QUARTERLY";
export type HandoverStatus = "SAFE" | "OUTSIDE" | "INVALID";

export interface CalculatorInput {
  totalPrice: number;
  /** Contract payment: percent of the total price, or a fixed amount. */
  contract: { mode: AmountMode; value: number };
  /** Down payment: percent of the price after the contract payment, or a fixed amount. */
  downPayment: { mode: AmountMode; value: number };
  annualRatePercent: number;
  annualTiming: AnnualTiming;
  frequency: InstallmentFrequency;
  termMonths: number;
  handoverMonth: number;
  /** Minimum share of the price that must be collected by handover. */
  targetPercent: number;
}

export interface TimelineRow {
  month: number;
  openingBalance: number;
  annualDue: number;
  installmentUnits: number;
  installmentPaid: number;
  totalPaid: number;
  cumulativePaid: number;
  /** Includes the contract and down payments, as a percent of the price. */
  cumulativePercent: number;
  closingBalance: number;
}

export interface CalculatorYear {
  year: number;
  annualPayment: number;
  installmentsCount: number;
  installmentsTotal: number;
  totalPaid: number;
}

export interface CalculatorResult {
  totalPrice: number;
  contractAmount: number;
  contractPercent: number;
  downPaymentAmount: number;
  downPaymentPercent: number;
  /** Balance after the contract and down payments. */
  financedBalance: number;
  monthlyInstallment: number;
  quarterlyInstallment: number;
  years: CalculatorYear[];
  handover: {
    month: number;
    paidAmount: number;
    paidPercent: number;
    targetAmount: number;
    difference: number;
    remainingBalance: number;
    status: HandoverStatus;
  };
  afterHandover: {
    monthsRemaining: number;
    monthlyCount: number;
    quarterlyCount: number;
    partialMonths: number;
    partialPayment: number;
  };
  timeline: TimelineRow[];
}

export function unitPrice(input: { areaSqm: number; pricePerSqm: number; extras: number }): number {
  return input.areaSqm * input.pricePerSqm + input.extras;
}

export function calculatePaymentPlan(input: CalculatorInput): CalculatorResult {
  const total = input.totalPrice;
  const term = Math.max(0, Math.floor(input.termMonths));
  const handoverMonth = Math.min(Math.max(0, Math.floor(input.handoverMonth)), term);
  const rate = input.annualRatePercent / 100;

  const contractAmount =
    input.contract.mode === "PERCENT" ? (total * input.contract.value) / 100 : input.contract.value;
  const afterContract = total - contractAmount;
  const downPaymentAmount =
    input.downPayment.mode === "PERCENT" ? (afterContract * input.downPayment.value) / 100 : input.downPayment.value;
  const financedBalance = total - contractAmount - downPaymentAmount;

  const isAnnualMonth = (month: number) =>
    month <= handoverMonth && (input.annualTiming === "START" ? (month - 1) % 12 === 0 : month % 12 === 0);
  const unitsIn = (month: number) => {
    if (input.frequency === "MONTHLY") return 1;
    if (month === term) return ((term - 1) % 3) + 1;
    return month % 3 === 0 ? 3 : 0;
  };

  // closing(m) = balanceFactor(m) * financed - installmentFactor(m) * x, solved for closing(term) = 0.
  let balanceFactor = 1;
  let installmentFactor = 0;
  for (let month = 1; month <= term; month++) {
    const factor = isAnnualMonth(month) ? 1 - rate : 1;
    balanceFactor *= factor;
    installmentFactor = installmentFactor * factor + unitsIn(month);
  }
  const monthlyInstallment = installmentFactor > 0 ? (balanceFactor * financedBalance) / installmentFactor : 0;

  const paidUpfront = contractAmount + downPaymentAmount;
  const timeline: TimelineRow[] = [];
  let opening = financedBalance;
  let cumulative = 0;
  for (let month = 1; month <= term; month++) {
    const annualDue = isAnnualMonth(month) ? opening * rate : 0;
    const installmentUnits = unitsIn(month);
    const installmentPaid = installmentUnits * monthlyInstallment;
    const totalPaid = annualDue + installmentPaid;
    cumulative += totalPaid;
    const closingBalance = Math.max(0, opening - annualDue - installmentPaid);
    timeline.push({
      month,
      openingBalance: opening,
      annualDue,
      installmentUnits,
      installmentPaid,
      totalPaid,
      cumulativePaid: cumulative,
      cumulativePercent: total > 0 ? ((cumulative + paidUpfront) / total) * 100 : 0,
      closingBalance,
    });
    opening = closingBalance;
  }

  const years: CalculatorYear[] = [];
  for (let year = 1; year <= Math.ceil(handoverMonth / 12); year++) {
    const rows = timeline.slice((year - 1) * 12, year * 12);
    const annualPayment = rows.reduce((sum, row) => sum + row.annualDue, 0);
    const installmentsTotal = rows.reduce((sum, row) => sum + row.installmentPaid, 0);
    years.push({
      year,
      annualPayment,
      installmentsCount: rows.filter((row) => row.installmentUnits > 0).length,
      installmentsTotal,
      totalPaid: annualPayment + installmentsTotal,
    });
  }

  const atHandover = handoverMonth > 0 ? timeline[handoverMonth - 1] : undefined;
  const paidAmount = paidUpfront + (atHandover?.cumulativePaid ?? 0);
  const paidPercent = total > 0 ? (paidAmount / total) * 100 : 0;
  const targetAmount = (total * input.targetPercent) / 100;
  const invalid =
    !(total > 0) || financedBalance < 0 || monthlyInstallment < 0 || paidAmount > total + 0.005 || term === 0;

  const monthsRemaining = term - handoverMonth;
  const quarterly = input.frequency === "QUARTERLY";

  return {
    totalPrice: total,
    contractAmount,
    contractPercent: total > 0 ? (contractAmount / total) * 100 : 0,
    downPaymentAmount,
    downPaymentPercent: afterContract > 0 ? (downPaymentAmount / afterContract) * 100 : 0,
    financedBalance,
    monthlyInstallment,
    quarterlyInstallment: monthlyInstallment * 3,
    years,
    handover: {
      month: handoverMonth,
      paidAmount,
      paidPercent,
      targetAmount,
      difference: paidAmount - targetAmount,
      remainingBalance: atHandover?.closingBalance ?? financedBalance,
      status: invalid ? "INVALID" : paidPercent >= input.targetPercent ? "SAFE" : "OUTSIDE",
    },
    afterHandover: {
      monthsRemaining,
      monthlyCount: quarterly ? 0 : monthsRemaining,
      quarterlyCount: quarterly ? Math.floor(monthsRemaining / 3) : 0,
      partialMonths: quarterly ? monthsRemaining % 3 : 0,
      partialPayment: quarterly ? monthlyInstallment * (monthsRemaining % 3) : 0,
    },
    timeline,
  };
}

/** Calendar month arithmetic in UTC (month-end dates are clamped, e.g. Jan 31 + 1 = Feb 28). */
function addMonthsUtc(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const result = new Date(date);
  result.setUTCFullYear(year, month, Math.min(date.getUTCDate(), lastDay));
  return result;
}

/**
 * Turns the timeline into dated installments (one per month with a payment),
 * rounded to piasters with the rounding drift absorbed by the last one so the
 * schedule adds up to the financed balance exactly.
 */
export function scheduleInstallments(
  result: CalculatorResult,
  startDate: Date,
): { sequence: number; month: number; amount: number; dueDate: Date }[] {
  const rows = result.timeline.filter((row) => row.totalPaid > 0.004);
  const schedule = rows.map((row, index) => ({
    sequence: index + 1,
    month: row.month,
    amount: Math.round(row.totalPaid * 100) / 100,
    // Month m falls due m months after signing.
    dueDate: addMonthsUtc(startDate, row.month),
  }));
  if (schedule.length > 0) {
    const target = Math.round(result.financedBalance * 100);
    const scheduled = schedule.reduce((sum, entry) => sum + Math.round(entry.amount * 100), 0);
    const last = schedule[schedule.length - 1];
    last.amount = (Math.round(last.amount * 100) + target - scheduled) / 100;
  }
  return schedule;
}
