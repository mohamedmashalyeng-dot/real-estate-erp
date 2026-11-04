"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/lib/context";
import { recordAudit } from "@/lib/audit";
import { AppError, ConflictError, actionFailure, actionSuccess, type ActionResult } from "@/lib/errors";
import { formatMoney, formatPercent } from "@/lib/format";
import { calculatePaymentPlan, scheduleInstallments } from "@/lib/payment-calculator";
import { readPricingSheet, type PricingSheetData } from "@/lib/pricing-sheet";
import { planSettingsSchema } from "./schema";

export async function refreshPricingSheetAction(): Promise<ActionResult<PricingSheetData>> {
  try {
    const context = await requirePermission("sales.view");
    const settings = await context.db.organizationSettings.findUnique({
      where: { organizationId: context.organizationId },
      select: { pricingSheetUrl: true },
    });
    if (!settings?.pricingSheetUrl) {
      throw new AppError("No calculator sheet is connected yet. Add one in Settings.", {
        code: "sheet_not_connected",
        status: 409,
      });
    }

    const data = await readPricingSheet(settings.pricingSheetUrl);
    await context.db.organizationSettings.update({
      where: { organizationId: context.organizationId },
      data: { pricingSheetData: data as unknown as Prisma.InputJsonValue, pricingSheetSyncedAt: new Date() },
    });

    await recordAudit({
      organizationId: context.organizationId,
      userId: context.user.id,
      actorEmail: context.user.email,
      action: "PRICING_SHEET_SYNC",
      entityType: "OrganizationSettings",
      metadata: { areaOptions: data.areaOptions, termMonths: data.termMonths },
    });

    revalidatePath("/sales/calculator");
    return actionSuccess(data, "Prices and plan defaults refreshed from the sheet.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function savePaymentPlanAction(
  saleId: string,
  settingsInput: unknown,
): Promise<ActionResult<{ installments: number }>> {
  try {
    const parsed = planSettingsSchema.safeParse(settingsInput);
    if (!parsed.success) return actionFailure(parsed.error);
    const context = await requirePermission("payments.manage");

    const sale = await context.db.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: { paymentPlan: { select: { id: true } } },
    });
    if (sale.status === "CANCELLED") {
      throw new ConflictError("This sale is cancelled.");
    }

    const existingPlanId = sale.paymentPlan?.id ?? null;
    if (existingPlanId) {
      const [paidInstallments, linkedPayments] = await Promise.all([
        context.db.installment.count({ where: { paymentPlanId: existingPlanId, paidAmount: { gt: 0 } } }),
        context.db.payment.count({ where: { installment: { paymentPlanId: existingPlanId } } }),
      ]);
      if (paidInstallments > 0 || linkedPayments > 0) {
        throw new ConflictError(
          "Payments were already collected against this sale's installments, so its plan can't be replaced.",
        );
      }
    }

    const settings = parsed.data;
    const result = calculatePaymentPlan({ ...settings, totalPrice: Number(sale.contractValue) });
    if (result.handover.status === "INVALID") {
      throw new AppError("These settings don't produce a valid plan for this sale. Review the inputs.", {
        code: "invalid_plan",
        status: 422,
      });
    }

    const schedule = scheduleInstallments(result, sale.saleDate);
    const now = new Date();
    const installmentLabel = settings.frequency === "MONTHLY" ? "monthly" : "quarterly";
    const notes = [
      `Payment calculator: ${formatPercent(result.contractPercent, 2)} contract + ${formatPercent(result.downPaymentPercent, 2)} down payment`,
      `${formatPercent(settings.annualRatePercent, 2)} annual payment (${settings.annualTiming === "START" ? "start" : "end"} of year) until month ${settings.handoverMonth}`,
      `${installmentLabel} installments of ${formatMoney(settings.frequency === "MONTHLY" ? result.monthlyInstallment : result.quarterlyInstallment, sale.currency, { maximumFractionDigits: 2 })} over ${settings.termMonths} months`,
      `${formatPercent(result.handover.paidPercent, 2)} paid by handover (${result.handover.status}, target ${formatPercent(settings.targetPercent, 0)})`,
    ].join("; ");

    const planData = {
      totalAmount: result.totalPrice.toFixed(2),
      downPayment: (result.contractAmount + result.downPaymentAmount).toFixed(2),
      installmentsCount: schedule.length,
      startDate: sale.saleDate,
      currency: sale.currency,
      notes: `${notes}.`,
    };

    await context.db.$transaction(async (tx) => {
      const plan = existingPlanId
        ? await tx.paymentPlan.update({ where: { id: existingPlanId }, data: planData })
        : await tx.paymentPlan.create({
            data: {
              organizationId: context.organizationId,
              saleId: sale.id,
              createdById: context.user.id,
              ...planData,
            },
          });
      if (existingPlanId) {
        await tx.installment.deleteMany({ where: { paymentPlanId: plan.id } });
      }
      await tx.installment.createMany({
        data: schedule.map((entry) => ({
          organizationId: context.organizationId,
          paymentPlanId: plan.id,
          sequence: entry.sequence,
          amount: entry.amount.toFixed(2),
          dueDate: entry.dueDate,
          status: entry.dueDate <= now ? ("DUE" as const) : ("UPCOMING" as const),
        })),
      });
    });

    await recordAudit({
      organizationId: context.organizationId,
      userId: context.user.id,
      actorEmail: context.user.email,
      action: existingPlanId ? "PAYMENT_PLAN_REPLACE" : "PAYMENT_PLAN_CREATE",
      entityType: "Sale",
      entityId: sale.id,
      metadata: {
        installments: schedule.length,
        monthlyInstallment: result.monthlyInstallment.toFixed(2),
        paidByHandoverPercent: result.handover.paidPercent.toFixed(2),
        handoverStatus: result.handover.status,
      },
    });

    revalidatePath("/finance/installments");
    revalidatePath("/sales");
    revalidatePath("/sales/calculator");
    return actionSuccess(
      { installments: schedule.length },
      `Payment plan saved to ${sale.reference}: ${schedule.length} installments.`,
    );
  } catch (error) {
    return actionFailure(error);
  }
}
