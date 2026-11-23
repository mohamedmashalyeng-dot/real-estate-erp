"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/context";
import { recordAudit } from "@/lib/audit";
import { AppError, actionFailure, actionSuccess, type ActionResult } from "@/lib/errors";
import { decryptFacebookToken } from "@/lib/facebook";
import { syncLeadsFromFacebook, type FacebookSyncSummary } from "@/lib/facebook-leads";

export async function syncFacebookLeadsAction(): Promise<ActionResult<FacebookSyncSummary>> {
  try {
    const context = await requirePermission("leads.create");
    const settings = await context.db.organizationSettings.findUnique({
      where: { organizationId: context.organizationId },
      select: { facebookPageId: true, facebookPageAccessToken: true },
    });
    if (!settings?.facebookPageId || !settings.facebookPageAccessToken) {
      throw new AppError("Connect a Facebook Page in Settings first.", { code: "facebook_not_connected", status: 409 });
    }
    const summary = await syncLeadsFromFacebook({
      db: context.db,
      organizationId: context.organizationId,
      currency: context.currency,
      userId: context.user.id,
      pageId: settings.facebookPageId,
      token: decryptFacebookToken(settings.facebookPageAccessToken, context.organizationId),
    });
    await context.db.organizationSettings.updateMany({
      where: { facebookPageId: settings.facebookPageId },
      data: { facebookLeadsSyncedAt: new Date() },
    });
    await recordAudit({
      organizationId: context.organizationId,
      userId: context.user.id,
      actorEmail: context.user.email,
      action: "FACEBOOK_LEADS_SYNC",
      entityType: "Lead",
      metadata: { pageId: settings.facebookPageId, ...summary },
    });
    revalidatePath("/crm/leads");
    revalidatePath("/dashboard");
    revalidatePath("/settings");
    return actionSuccess(summary, `${summary.created} new, ${summary.unchanged} already imported across ${summary.forms} forms.`);
  } catch (error) {
    return actionFailure(error);
  }
}
