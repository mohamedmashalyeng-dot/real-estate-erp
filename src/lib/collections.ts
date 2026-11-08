import type { InstallmentStatus } from "@/generated/prisma/enums";
import { toNumber, type Numeric } from "./format";

/**
 * Collections rules shared by the finance pages, the payment action and the
 * reports. Money is handled in whole cents so partial payments never drift.
 */

export function toCents(value: Numeric): number {
  return Math.round(toNumber(value) * 100);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Midnight (server local time) of the given day. */
export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Status of an installment from its amount, what was paid and its due date.
 * An installment due before today that isn't fully paid is OVERDUE, even
 * when partly paid, so it shows up in the arrears list.
 */
export function deriveInstallmentStatus(
  input: { amount: Numeric; paidAmount: Numeric; dueDate: Date },
  now: Date = new Date(),
): InstallmentStatus {
  const amount = toCents(input.amount);
  const paid = toCents(input.paidAmount);
  if (amount > 0 && paid >= amount) return "PAID";
  if (input.dueDate < startOfDay(now)) return "OVERDUE";
  if (paid > 0) return "PARTIALLY_PAID";
  if (input.dueDate <= now) return "DUE";
  return "UPCOMING";
}

export function remainingCents(input: { amount: Numeric; paidAmount: Numeric }): number {
  return Math.max(0, toCents(input.amount) - toCents(input.paidAmount));
}

export interface PaymentAllocation {
  paidAmount: string;
  status: InstallmentStatus;
  /** Set when this payment settles the installment. */
  settled: boolean;
}

/**
 * Applies a payment to an installment. Overpayments are rejected rather than
 * silently spilling over, so every payment maps to exactly one installment.
 */
export function allocatePayment(
  installment: { amount: Numeric; paidAmount: Numeric; dueDate: Date },
  payment: Numeric,
  now: Date = new Date(),
): PaymentAllocation {
  const paymentCents = toCents(payment);
  if (paymentCents <= 0) {
    throw new RangeError("Payment amount must be greater than zero.");
  }
  const remaining = remainingCents(installment);
  if (remaining === 0) {
    throw new RangeError("This installment is already fully paid.");
  }
  if (paymentCents > remaining) {
    throw new RangeError(
      `Payment exceeds the remaining balance of ${fromCents(remaining)} on this installment.`,
    );
  }
  const newPaid = toCents(installment.paidAmount) + paymentCents;
  const status = deriveInstallmentStatus(
    { amount: installment.amount, paidAmount: fromCents(newPaid), dueDate: installment.dueDate },
    now,
  );
  return { paidAmount: fromCents(newPaid), status, settled: status === "PAID" };
}

export const AGING_BUCKETS = [
  { key: "d0_30", label: "1–30 days", min: 1, max: 30 },
  { key: "d31_60", label: "31–60 days", min: 31, max: 60 },
  { key: "d61_90", label: "61–90 days", min: 61, max: 90 },
  { key: "d90_plus", label: "90+ days", min: 91, max: Number.POSITIVE_INFINITY },
] as const;

export type AgingBucketKey = (typeof AGING_BUCKETS)[number]["key"];

export function daysOverdue(dueDate: Date, now: Date = new Date()): number {
  const ms = startOfDay(now).getTime() - startOfDay(dueDate).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** Groups unpaid balances of past-due installments by how late they are. */
export function agingReport(
  installments: { amount: Numeric; paidAmount: Numeric; dueDate: Date }[],
  now: Date = new Date(),
): { buckets: Record<AgingBucketKey, { count: number; amount: string }>; totalCents: number } {
  const cents: Record<AgingBucketKey, { count: number; cents: number }> = {
    d0_30: { count: 0, cents: 0 },
    d31_60: { count: 0, cents: 0 },
    d61_90: { count: 0, cents: 0 },
    d90_plus: { count: 0, cents: 0 },
  };
  let totalCents = 0;
  for (const installment of installments) {
    const remaining = remainingCents(installment);
    const days = daysOverdue(installment.dueDate, now);
    if (remaining === 0 || days === 0) continue;
    const bucket = AGING_BUCKETS.find((entry) => days >= entry.min && days <= entry.max)!;
    cents[bucket.key].count += 1;
    cents[bucket.key].cents += remaining;
    totalCents += remaining;
  }
  const buckets = Object.fromEntries(
    Object.entries(cents).map(([key, value]) => [key, { count: value.count, amount: fromCents(value.cents) }]),
  ) as Record<AgingBucketKey, { count: number; amount: string }>;
  return { buckets, totalCents };
}

type StatusClient = {
  installment: {
    updateMany(args: {
      where: Record<string, unknown>;
      data: { status: InstallmentStatus };
    }): Promise<{ count: number }>;
  };
};

/**
 * Moves installments whose due date has passed into DUE / OVERDUE. Cheap and
 * idempotent, so the finance pages run it on load instead of needing a cron.
 */
export async function syncInstallmentStatuses(db: StatusClient, now: Date = new Date()): Promise<number> {
  const today = startOfDay(now);
  const [overdue, due, notYetDue] = await Promise.all([
    db.installment.updateMany({
      where: { status: { in: ["UPCOMING", "DUE", "PARTIALLY_PAID"] }, dueDate: { lt: today } },
      data: { status: "OVERDUE" },
    }),
    db.installment.updateMany({
      where: { status: "UPCOMING", dueDate: { gte: today, lte: now } },
      data: { status: "DUE" },
    }),
    // Untouched installments marked DUE ahead of their due date go back to UPCOMING.
    db.installment.updateMany({
      where: { status: "DUE", dueDate: { gt: now }, paidAmount: 0 },
      data: { status: "UPCOMING" },
    }),
  ]);
  return overdue.count + due.count + notYetDue.count;
}
