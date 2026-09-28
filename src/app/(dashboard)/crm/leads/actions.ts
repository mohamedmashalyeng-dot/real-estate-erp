"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/context";
import { recordAudit } from "@/lib/audit";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/errors";
import type { ActivityType, LeadStage } from "@/generated/prisma/enums";
import { LEAD_STAGE_VALUES } from "./new/schema";

const stageSchema = z.enum(LEAD_STAGE_VALUES);

export async function updateLeadStageAction(
  leadId: string,
  stage: string,
): Promise<ActionResult<{ stage: LeadStage }>> {
  try {
    const parsed = stageSchema.safeParse(stage);
    if (!parsed.success) return actionFailure(parsed.error);
    const nextStage = parsed.data;
    const context = await requirePermission("leads.update");

    const existing = await context.db.lead.findUniqueOrThrow({ where: { id: leadId } });
    if (existing.stage === nextStage) {
      return actionSuccess({ stage: nextStage }, "Stage is already up to date.");
    }

    await context.db.lead.update({
      where: { id: leadId },
      data: {
        stage: nextStage,
        lostReason: nextStage === "LOST" ? existing.lostReason : null,
        wonAt: nextStage === "WON" ? new Date() : existing.wonAt,
        qualifiedAt: nextStage === "QUALIFIED" ? new Date() : existing.qualifiedAt,
        lastActivityAt: new Date(),
      },
    });

    await context.db.leadActivity.create({
      data: {
        organizationId: context.organizationId,
        leadId,
        userId: context.user.id,
        type: "STAGE_CHANGE",
        subject: `Stage moved from ${existing.stage} to ${nextStage}`,
      },
    });

    await recordAudit({
      organizationId: context.organizationId,
      userId: context.user.id,
      actorEmail: context.user.email,
      action: "LEAD_STAGE_UPDATE",
      entityType: "Lead",
      entityId: leadId,
      metadata: { previousStage: existing.stage, newStage: nextStage },
    });

    revalidatePath(`/crm/leads/${leadId}`);
    revalidatePath(`/crm/leads`);
    return actionSuccess({ stage: nextStage }, `Lead moved to ${nextStage}.`);
  } catch (error) {
    return actionFailure(error);
  }
}

const activityTypeSchema = z.enum(["CALL", "MEETING", "EMAIL", "WHATSAPP", "NOTE"] as unknown as [
  ActivityType,
  ...ActivityType[],
]);

const noteSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required.").max(160),
  body: z.string().trim().max(4000).optional(),
  type: activityTypeSchema.default("NOTE"),
});

export async function addLeadNoteAction(
  leadId: string,
  input: { subject: string; body?: string; type?: string },
): Promise<ActionResult<{ activityId: string }>> {
  try {
    const parsed = noteSchema.safeParse(input);
    if (!parsed.success) return actionFailure(parsed.error);
    const context = await requirePermission("leads.update");

    const activity = await context.db.leadActivity.create({
      data: {
        organizationId: context.organizationId,
        leadId,
        userId: context.user.id,
        type: parsed.data.type,
        subject: parsed.data.subject,
        body: parsed.data.body?.trim() ? parsed.data.body.trim() : null,
      },
    });

    await context.db.lead.update({
      where: { id: leadId },
      data: { lastActivityAt: new Date(), lastContactedAt: new Date() },
    });

    revalidatePath(`/crm/leads/${leadId}`);
    return actionSuccess({ activityId: activity.id }, "Activity logged.");
  } catch (error) {
    return actionFailure(error);
  }
}
