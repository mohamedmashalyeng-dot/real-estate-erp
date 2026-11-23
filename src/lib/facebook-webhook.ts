import { z } from "zod";
import { decryptFacebookToken, facebookId, facebookLeadSchema, facebookRequest, FACEBOOK_LEAD_FIELDS } from "./facebook";
import { importFacebookLead } from "./facebook-leads";
import { forOrganization, prisma } from "./prisma";

const webhookId = z.union([facebookId, z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).transform(String)]);
export const facebookWebhookSchema = z.object({
  object: z.literal("page"),
  entry: z.array(z.object({
    id: webhookId,
    changes: z.array(z.object({ field: z.string(), value: z.unknown() })).default([]),
  })),
});
const leadgenSchema = z.object({ leadgen_id: webhookId, page_id: webhookId, form_id: webhookId.optional() });

export async function processFacebookWebhook(payload: z.infer<typeof facebookWebhookSchema>): Promise<void> {
  for (const entry of payload.entry) {
    // Platform-level tenant discovery: the signed Page ID must be connected to
    // exactly one active organization; every subsequent write is tenant scoped.
    const settings = await prisma.organizationSettings.findFirst({
      where: { facebookPageId: entry.id, organization: { status: { in: ["ACTIVE", "TRIAL"] } } },
      select: { organizationId: true, facebookPageAccessToken: true, organization: { select: { currency: true } } },
    });
    if (!settings?.facebookPageAccessToken) continue;
    const db = forOrganization(settings.organizationId);
    let receivedLead = false;
    for (const change of entry.changes) {
      if (change.field !== "leadgen") continue;
      const value = leadgenSchema.parse(change.value);
      if (value.page_id !== entry.id) continue;
      const token = decryptFacebookToken(settings.facebookPageAccessToken, settings.organizationId);
      const lead = await facebookRequest(value.leadgen_id, token, facebookLeadSchema, { fields: FACEBOOK_LEAD_FIELDS });
      if (lead.id !== value.leadgen_id) throw new Error("Facebook lead ID mismatch");
      await importFacebookLead({
        db,
        organizationId: settings.organizationId,
        currency: settings.organization.currency,
        pageId: entry.id,
        lead: { ...lead, form_id: lead.form_id ?? value.form_id },
      });
      receivedLead = true;
    }
    if (receivedLead) {
      await db.organizationSettings.updateMany({
        where: { facebookPageId: entry.id },
        data: { facebookLeadsSyncedAt: new Date() },
      });
    }
  }
}
