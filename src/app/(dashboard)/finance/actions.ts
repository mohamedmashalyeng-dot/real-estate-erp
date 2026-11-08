"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/context";
import { recordAudit } from "@/lib/audit";
import { AppError, ConflictError, actionFailure, actionSuccess, type ActionResult } from "@/lib/errors";
import { allocatePayment } from "@/lib/collections";
import { notifyUsers } from "@/lib/notifications";

const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"] as const;

const paymentSchema = z.object({
  installmentId: z.string().trim().min(1),
  amount: z.coerce.number({ message: "Enter an amount." }).positive("Amount must be greater than zero."),
  paidAt: z
    .string()
    .trim()
    .min(1, "Payment date is required.")
    .transform((value) => new Date(value))
    .refine((date) => !Number.isNaN(date.getTime()), "Payment date is invalid.")
    .refine((date) => date.getTime() <= Date.now() + 86_400_000, "Payment date can't be in the future."),
  method: z.enum(PAYMENT_METHODS).default("CASH"),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type RecordPaymentInput = z.input<typeof paymentSchema>;

export async function recordPaymentAction(
  input: RecordPaymentInput,
): Promise<ActionResult<{ paymentId: string; status: string }>> {
  try {
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) return actionFailure(parsed.error);
    const data = parsed.data;
    const context = await requirePermission("payments.create");

    const result = await context.db.$transaction(async (tx) => {
      const installment = await tx.installment.findUniqueOrThrow({
        where: { id: data.installmentId },
        include: { paymentPlan: { include: { sale: { select: { id: true, status: true, leadId: true, reference: true, salespersonId: true } } } } },
      });
      const sale = installment.paymentPlan.sale;
      if (sale.status === "CANCELLED") {
        throw new ConflictError("This sale is cancelled, so payments can't be recorded against it.");
      }

      let allocation;
      try {
        allocation = allocatePayment(installment, data.amount);
      } catch (error) {
        throw new AppError(error instanceof Error ? error.message : "Invalid payment amount.", {
          code: "invalid_amount",
          status: 422,
          fieldErrors: { amount: [error instanceof Error ? error.message : "Invalid payment amount."] },
        });
      }

      // Guard against two cashiers paying the same installment at once: only
      // update if paidAmount is still what we read.
      const updated = await tx.installment.updateMany({
        where: { id: installment.id, paidAmount: installment.paidAmount },
        data: {
          paidAmount: allocation.paidAmount,
          status: allocation.status,
          paidAt: allocation.settled ? data.paidAt : installment.paidAt,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictError("This installment was updated by someone else. Refresh and try again.");
      }

      const payment = await tx.payment.create({
        data: {
          organizationId: context.organizationId,
          saleId: sale.id,
          installmentId: installment.id,
          leadId: sale.leadId,
          amount: data.amount.toFixed(2),
          currency: installment.paymentPlan.currency,
          paidAt: data.paidAt,
          method: data.method,
          reference: data.reference || null,
          notes: data.notes || null,
          receivedById: context.user.id,
        },
      });

      return { payment, installment, sale, allocation };
    });

    await recordAudit({
      organizationId: context.organizationId,
      userId: context.user.id,
      actorEmail: context.user.email,
      action: "PAYMENT_RECORD",
      entityType: "Payment",
      entityId: result.payment.id,
      metadata: {
        saleId: result.sale.id,
        installmentId: result.installment.id,
        sequence: result.installment.sequence,
        amount: result.payment.amount.toString(),
        method: result.payment.method,
        installmentStatus: result.allocation.status,
      },
    });

    if (result.sale.salespersonId !== context.user.id) {
      await notifyUsers(
        {
          organizationId: context.organizationId,
          type: "PAYMENT_RECEIVED",
          title: `Payment received on ${result.sale.reference}`,
          body: `Installment #${result.installment.sequence}: ${result.payment.amount.toString()} ${result.payment.currency}`,
          link: `/finance/sales/${result.sale.id}`,
          entityType: "Sale",
          entityId: result.sale.id,
        },
        [result.sale.salespersonId],
      ).catch(() => undefined);
    }

    revalidatePath("/finance/installments");
    revalidatePath(`/finance/sales/${result.sale.id}`);
    revalidatePath("/dashboard");
    return actionSuccess(
      { paymentId: result.payment.id, status: result.allocation.status },
      result.allocation.settled ? "Installment fully paid." : "Partial payment recorded.",
    );
  } catch (error) {
    return actionFailure(error);
  }
}
