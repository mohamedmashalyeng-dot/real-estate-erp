"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/context";
import { recordAudit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notifications";
import { actionFailure, type ActionResult } from "@/lib/errors";
import { createLeadSchema } from "./schema";

export async function createLeadAction(
  formData: FormData,
): Promise<ActionResult<{ leadId: string }>> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = createLeadSchema.safeParse({
    ...raw,
    budgetMin: raw.budgetMin === "" ? undefined : raw.budgetMin,
    budgetMax: raw.budgetMax === "" ? undefined : raw.budgetMax,
  });
  if (!parsed.success) {
    return actionFailure(parsed.error);
  }

  try {
    const context = await requirePermission("leads.create");

    const lead = await context.db.lead.create({
      data: {
        organizationId: context.organizationId,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone,
        email: parsed.data.email,
        country: parsed.data.country || null,
        city: parsed.data.city || null,
        budgetMin: parsed.data.budgetMin?.toFixed(2),
        budgetMax: parsed.data.budgetMax?.toFixed(2),
        source: parsed.data.source,
        temperature: parsed.data.temperature,
        priorityCategory: parsed.data.temperature,
        assignedToId: parsed.data.assignedToId,
        notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
        createdById: context.user.id,
      },
    });

    await context.db.leadActivity.create({
      data: {
        organizationId: context.organizationId,
        leadId: lead.id,
        userId: context.user.id,
        type: "SYSTEM",
        subject: "Lead created manually",
        body: parsed.data.notes?.trim() || null,
      },
    });

    if (parsed.data.assignedToId) {
      await notifyUsers(
        {
          organizationId: context.organizationId,
          type: "LEAD_ASSIGNED",
          title: "New lead assigned to you",
          body: `${lead.firstName} ${lead.lastName} · ${lead.phone}`,
          link: `/crm/leads/${lead.id}`,
          entityType: "Lead",
          entityId: lead.id,
        },
        [parsed.data.assignedToId],
      );
    }

    await recordAudit({
      organizationId: context.organizationId,
      userId: context.user.id,
      actorEmail: context.user.email,
      action: "LEAD_CREATE",
      entityType: "Lead",
      entityId: lead.id,
    });

    revalidatePath("/crm/leads");
  } catch (error) {
    return actionFailure(error);
  }

  redirect("/crm/leads");
}
