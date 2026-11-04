"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/context";
import { recordAudit } from "@/lib/audit";
import { AppError, actionFailure, actionSuccess, type ActionResult } from "@/lib/errors";
import { syncLeadsFromSheet, type SheetSyncSummary } from "@/lib/lead-sheet-sync";

export async function syncLeadsSheetAction(): Promise<ActionResult<SheetSyncSummary>> {
  try {
    const context = await requirePermission("leads.create");

    const [settings, organization] = await Promise.all([
      context.db.organizationSettings.findUnique({ where: { organizationId: context.organizationId } }),
      context.db.organization.findUniqueOrThrow({
        where: { id: context.organizationId },
        select: { timezone: true },
      }),
    ]);
    if (!settings?.leadsSheetUrl) {
      throw new AppError("No Google Sheet is connected yet. Add one in Settings.", {
        code: "sheet_not_connected",
        status: 409,
      });
    }

    const summary = await syncLeadsFromSheet({
      db: context.db,
      organizationId: context.organizationId,
      userId: context.user.id,
      sheetUrl: settings.leadsSheetUrl,
      timeZone: organization.timezone,
    });

    await context.db.organizationSettings.update({
      where: { organizationId: context.organizationId },
      data: { leadsSheetSyncedAt: new Date() },
    });

    await recordAudit({
      organizationId: context.organizationId,
      userId: context.user.id,
      actorEmail: context.user.email,
      action: "LEADS_SHEET_SYNC",
      entityType: "Lead",
      metadata: { ...summary },
    });

    revalidatePath("/crm/leads");
    revalidatePath("/dashboard");
    return actionSuccess(
      summary,
      `${summary.created} new, ${summary.updated} updated, ${summary.unchanged} unchanged.`,
    );
  } catch (error) {
    return actionFailure(error);
  }
}
