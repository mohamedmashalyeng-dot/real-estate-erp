import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { TenantScopedClient } from "./prisma";
import { normalizeSheetPhone } from "./lead-sheet-sync";
import { FACEBOOK_LEAD_FIELDS, facebookForms, facebookId, facebookLeadSchema, facebookPages, type FacebookLead } from "./facebook";

export interface FacebookSyncSummary {
  forms: number;
  created: number;
  unchanged: number;
}

export function mapFacebookLead(lead: FacebookLead, pageId: string) {
  const fields = new Map(lead.field_data.map((field) => [field.name.toLowerCase(), field.values.join(", ").trim()]));
  const fullName = fields.get("full_name")?.split(/\s+/).filter(Boolean) ?? [];
  const firstName = fields.get("first_name") || fullName[0] || "Unknown";
  const lastName = fields.get("last_name") || fullName.slice(1).join(" ");
  const rawPhone = fields.get("phone_number") || fields.get("phone") || fields.get("whatsapp_number") || "";
  const email = fields.get("email") || fields.get("work_email");
  const createdAt = lead.created_time ? new Date(lead.created_time) : null;
  const notes = [
    `Facebook Page: ${pageId}`,
    `Lead ID: ${lead.id}`,
    ...(lead.form_id ? [`Form ID: ${lead.form_id}`] : []),
    ...(lead.ad_id ? [`Ad ID: ${lead.ad_id}`] : []),
    ...lead.field_data.map((field) => `${field.name}: ${field.values.join(", ")}`),
  ].join("\n");
  return {
    firstName,
    lastName,
    phone: normalizeSheetPhone(rawPhone) ?? rawPhone,
    email: email && z.email().safeParse(email).success ? email : null,
    city: fields.get("city") || null,
    country: fields.get("country") || null,
    source: "FACEBOOK" as const,
    stage: "NEW" as const,
    externalRef: `facebook:${pageId}:${lead.id}`,
    notes,
    ...(createdAt && Number.isFinite(createdAt.getTime()) ? { createdAt } : {}),
  };
}

/** The unique externalRef makes simultaneous webhook delivery and backfills safe. */
export async function importFacebookLead(input: {
  db: TenantScopedClient;
  organizationId: string;
  currency: string;
  pageId: string;
  lead: FacebookLead;
  userId?: string | null;
}): Promise<boolean> {
  const { db, organizationId, pageId, userId } = input;
  const lead = facebookLeadSchema.parse(input.lead);
  facebookId.parse(pageId);
  const mapped = mapFacebookLead(lead, pageId);
  return db.$transaction(async (tx) => {
    const id = randomUUID();
    const result = await tx.lead.createMany({
      data: { id, organizationId, ...mapped, currency: input.currency, createdById: userId ?? null },
      skipDuplicates: true,
    });
    if (!result.count) return false;
    await tx.leadActivity.create({
      data: {
        organizationId,
        leadId: id,
        userId: userId ?? null,
        type: "SYSTEM",
        subject: "Lead imported from Facebook Lead Ads",
        body: mapped.notes,
        metadata: { source: "facebook", pageId, leadId: lead.id, formId: lead.form_id ?? null, adId: lead.ad_id ?? null },
      },
    });
    return true;
  });
}

export async function syncLeadsFromFacebook(input: {
  db: TenantScopedClient;
  organizationId: string;
  currency: string;
  userId: string | null;
  pageId: string;
  token: string;
}): Promise<FacebookSyncSummary> {
  const summary: FacebookSyncSummary = { forms: 0, created: 0, unchanged: 0 };
  for await (const forms of facebookForms(input.pageId, input.token)) {
    for (const form of forms) {
      summary.forms++;
      for await (const leads of facebookPages(`${form.id}/leads`, input.token, facebookLeadSchema, FACEBOOK_LEAD_FIELDS)) {
        for (const lead of leads) {
          const created = await importFacebookLead({ ...input, lead: { ...lead, form_id: lead.form_id ?? form.id } });
          summary[created ? "created" : "unchanged"]++;
        }
      }
    }
  }
  return summary;
}
