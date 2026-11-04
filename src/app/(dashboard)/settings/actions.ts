"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/lib/context";
import { recordAudit } from "@/lib/audit";
import { AppError, actionFailure, actionSuccess, type ActionResult } from "@/lib/errors";
import { readSheetLeads } from "@/lib/lead-sheet-sync";
import { readPricingSheet } from "@/lib/pricing-sheet";
import { parseSpreadsheetId } from "@/lib/google-sheets";

function readSheetUrl(formData: FormData): string {
  const url = String(formData.get("sheetUrl") ?? "").trim();
  if (url && !parseSpreadsheetId(url)) {
    throw new AppError("Please correct the highlighted fields.", {
      code: "validation_error",
      status: 422,
      fieldErrors: { sheetUrl: ["Paste a Google Sheets link (https://docs.google.com/spreadsheets/d/...)."] },
    });
  }
  return url;
}

export async function saveLeadsSheetUrlAction(
  formData: FormData,
): Promise<ActionResult<{ url: string | null }>> {
  try {
    const context = await requirePermission("settings.manage");
    const url = readSheetUrl(formData);
    let message = "Google Sheet disconnected.";

    if (url) {
      // Fail now rather than on the first sync if the sheet is private or has no lead tab.
      const organization = await context.db.organization.findUniqueOrThrow({
        where: { id: context.organizationId },
        select: { timezone: true },
      });
      const { tabs, leads } = await readSheetLeads(url, organization.timezone);
      message = `Connected: ${leads.length} leads found in ${tabs.join(", ")}.`;
    }

    await context.db.organizationSettings.upsert({
      where: { organizationId: context.organizationId },
      create: { organizationId: context.organizationId, leadsSheetUrl: url || null },
      update: { leadsSheetUrl: url || null },
    });

    await recordAudit({
      organizationId: context.organizationId,
      userId: context.user.id,
      actorEmail: context.user.email,
      action: url ? "LEADS_SHEET_CONNECT" : "LEADS_SHEET_DISCONNECT",
      entityType: "OrganizationSettings",
      metadata: { url: url || null },
    });

    revalidatePath("/settings");
    revalidatePath("/crm/leads");
    return actionSuccess({ url: url || null }, message);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function savePricingSheetUrlAction(
  formData: FormData,
): Promise<ActionResult<{ url: string | null }>> {
  try {
    const context = await requirePermission("settings.manage");
    const url = readSheetUrl(formData);
    const data = url ? await readPricingSheet(url) : null;
    const fields = {
      pricingSheetUrl: url || null,
      pricingSheetData: data ? (data as unknown as Prisma.InputJsonValue) : undefined,
      pricingSheetSyncedAt: data ? new Date() : null,
    };

    await context.db.organizationSettings.upsert({
      where: { organizationId: context.organizationId },
      create: { organizationId: context.organizationId, ...fields },
      update: url ? fields : { pricingSheetUrl: null, pricingSheetData: Prisma.DbNull, pricingSheetSyncedAt: null },
    });

    await recordAudit({
      organizationId: context.organizationId,
      userId: context.user.id,
      actorEmail: context.user.email,
      action: url ? "PRICING_SHEET_CONNECT" : "PRICING_SHEET_DISCONNECT",
      entityType: "OrganizationSettings",
      metadata: { url: url || null },
    });

    revalidatePath("/settings");
    revalidatePath("/sales/calculator");
    return actionSuccess(
      { url: url || null },
      data
        ? `Connected: ${data.areaOptions.map((option) => `${option.areaSqm} m²`).join(", ")} · ${data.termMonths}-month term.`
        : "Calculator sheet disconnected.",
    );
  } catch (error) {
    return actionFailure(error);
  }
}
