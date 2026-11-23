"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/lib/context";
import { recordAudit } from "@/lib/audit";
import { AppError, actionFailure, actionSuccess, type ActionResult } from "@/lib/errors";
import { decryptFacebookToken, encryptFacebookToken, facebookForms, facebookId, facebookRequest, missingFacebookConfiguration } from "@/lib/facebook";

export async function connectFacebookPageAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const context = await requirePermission("settings.manage");
    const missing = missingFacebookConfiguration();
    if (missing.length) throw new AppError(`Configure ${missing.join(", ")} on the server first.`, { code: "facebook_configuration", status: 503 });
    const pageId = facebookId.parse(String(formData.get("pageId") ?? "").trim());
    const existing = await context.db.organizationSettings.findUnique({
      where: { organizationId: context.organizationId },
      select: { facebookPageId: true, facebookPageAccessToken: true },
    });
    const providedToken = String(formData.get("pageToken") ?? "").trim();
    const token = providedToken || (existing?.facebookPageId === pageId && existing.facebookPageAccessToken
      ? decryptFacebookToken(existing.facebookPageAccessToken, context.organizationId)
      : "");
    if (!token) throw new AppError("Enter a Page access token.", { code: "validation_error", fieldErrors: { pageToken: ["A Page access token is required."] } });
    // Validate the token against /me so a user token cannot masquerade as a Page token.
    const page = await facebookRequest("me", token, z.object({ id: facebookId, name: z.string() }), { fields: "id,name" });
    if (page.id !== pageId) throw new AppError("This token belongs to a different Page or to a user. Generate a Page access token for the selected Page.", { code: "facebook_page_mismatch" });
    const encryptedToken = encryptFacebookToken(token, context.organizationId);
    // Check form access before persisting anything or subscribing the app.
    for await (const forms of facebookForms(pageId, token)) {
      void forms;
      break;
    }
    await facebookRequest(`${pageId}/subscribed_apps`, token, z.object({ success: z.literal(true) }), { subscribed_fields: "leadgen" }, "POST");
    const fields = { facebookPageId: pageId, facebookPageName: page.name, facebookPageAccessToken: encryptedToken };
    await context.db.organizationSettings.upsert({
      where: { organizationId: context.organizationId },
      create: { organizationId: context.organizationId, ...fields },
      update: { ...fields, ...(existing?.facebookPageId !== pageId ? { facebookLeadsSyncedAt: null } : {}) },
    });
    await recordAudit({
      organizationId: context.organizationId,
      userId: context.user.id,
      actorEmail: context.user.email,
      action: "FACEBOOK_PAGE_CONNECT",
      entityType: "OrganizationSettings",
      metadata: { pageId, pageName: page.name },
    });
    revalidatePath("/settings");
    revalidatePath("/crm/leads");
    return actionSuccess(undefined, `Connected to ${page.name}. Sync Facebook on the Leads page to import available submissions.`);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return actionFailure(new AppError("This Facebook Page is already connected to another organization.", { code: "facebook_page_in_use", status: 409 }));
    }
    return actionFailure(error);
  }
}

export async function disconnectFacebookPageAction(): Promise<ActionResult<undefined>> {
  try {
    const context = await requirePermission("settings.manage");
    await context.db.organizationSettings.updateMany({
      data: { facebookPageId: null, facebookPageName: null, facebookPageAccessToken: null, facebookLeadsSyncedAt: null },
    });
    await recordAudit({
      organizationId: context.organizationId,
      userId: context.user.id,
      actorEmail: context.user.email,
      action: "FACEBOOK_PAGE_DISCONNECT",
      entityType: "OrganizationSettings",
    });
    revalidatePath("/settings");
    revalidatePath("/crm/leads");
    return actionSuccess(undefined, "Facebook Page disconnected. Imported leads remain in CRM.");
  } catch (error) {
    return actionFailure(error);
  }
}
