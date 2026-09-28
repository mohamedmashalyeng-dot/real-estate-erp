"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/context";
import { notifyUsers } from "@/lib/notifications";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/errors";
import {
  FOLLOW_UP_STATUS_VALUES,
  FOLLOW_UP_TYPE_VALUES,
  LEAD_TEMPERATURE_VALUES,
  PRIORITY_VALUES,
} from "./new/schema";

const followUpSchema = z.object({
  leadId: z.string().uuid("Invalid lead."),
  type: z.enum(FOLLOW_UP_TYPE_VALUES),
  dueAt: z.string().min(1, "Due date is required."),
  priority: z.enum(PRIORITY_VALUES),
  notes: z.string().trim().max(2000).optional(),
});


export async function createFollowUpAction(input: {
  leadId: string;
  dueAt: string;
  type: string;
  priority: string;
  notes?: string;
}): Promise<ActionResult<{ followUpId: string }>> {
  try {
    const parsed = followUpSchema.safeParse(input);
    if (!parsed.success) return actionFailure(parsed.error);
    const context = await requirePermission("followups.manage");

    const lead = await context.db.lead.findUniqueOrThrow({
      where: { id: parsed.data.leadId, organizationId: context.organizationId },
    });

    const followUp = await context.db.followUp.create({
      data: {
        organizationId: context.organizationId,
        leadId: parsed.data.leadId,
        assignedToId: lead.assignedToId ?? context.user.id,
        type: parsed.data.type,
        priority: parsed.data.priority,
        dueAt: new Date(parsed.data.dueAt),
        notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
        createdById: context.user.id,
      },
    });

    const nextFollowUp = await context.db.followUp.findFirst({
      where: {
        organizationId: context.organizationId,
        leadId: parsed.data.leadId,
        status: "PENDING",
      },
      orderBy: { dueAt: "asc" },
      select: { dueAt: true },
    });

    await context.db.lead.update({
      where: { id: parsed.data.leadId },
      data: { nextFollowUpAt: nextFollowUp?.dueAt ?? followUp.dueAt, lastActivityAt: new Date() },
    });

    await context.db.leadActivity.create({
      data: {
        organizationId: context.organizationId,
        leadId: parsed.data.leadId,
        userId: context.user.id,
        type: "NOTE",
        subject: `${parsed.data.type} follow-up scheduled`,
        body: parsed.data.notes?.trim() || null,
      },
    });

    revalidatePath(`/crm/leads/${parsed.data.leadId}`);
    revalidatePath(`/crm/leads`);
    return actionSuccess({ followUpId: followUp.id }, "Follow-up scheduled.");
  } catch (error) {
    return actionFailure(error);
  }
}

const completeFollowUpSchema = z.object({
  outcome: z.string().trim().max(2000).optional(),
  status: z.enum(FOLLOW_UP_STATUS_VALUES),
});

export async function completeFollowUpAction(
  leadId: string,
  followUpId: string,
  input: { outcome?: string; status?: string },
): Promise<ActionResult<{ followUpId: string }>> {
  try {
    const parsed = completeFollowUpSchema.safeParse({
      outcome: input.outcome,
      status: input.status ?? "COMPLETED",
    });
    if (!parsed.success) return actionFailure(parsed.error);
    const context = await requirePermission("followups.manage");

    const followUp = await context.db.followUp.update({
      where: { id: followUpId, leadId, organizationId: context.organizationId },
      data: {
        status: parsed.data.status,
        outcome: parsed.data.outcome?.trim() ? parsed.data.outcome.trim() : null,
        completedAt: new Date(),
        completedById: context.user.id,
      },
    });

    const nextFollowUp = await context.db.followUp.findFirst({
      where: {
        organizationId: context.organizationId,
        leadId,
        status: "PENDING",
      },
      orderBy: { dueAt: "asc" },
      select: { dueAt: true },
    });

    await context.db.lead.update({
      where: { id: leadId, organizationId: context.organizationId },
      data: { lastActivityAt: new Date(), nextFollowUpAt: nextFollowUp?.dueAt ?? null },
    });

    await context.db.leadActivity.create({
      data: {
        organizationId: context.organizationId,
        leadId,
        userId: context.user.id,
        type: "NOTE",
        subject: `${followUp.type} follow-up marked ${parsed.data.status}`,
        body: parsed.data.outcome?.trim() || null,
      },
    });

    revalidatePath(`/crm/leads/${leadId}`);
    revalidatePath(`/crm/leads`);
    return actionSuccess({ followUpId }, "Follow-up updated.");
  } catch (error) {
    return actionFailure(error);
  }
}

const assignSchema = z.object({
  assignedToId: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .refine((value) => value === null || /^[0-9a-f-]{36}$/i.test(value), {
      message: "Select an agent to assign.",
    }),
});

export async function assignLeadAction(
  leadId: string,
  assignedToId: string,
): Promise<ActionResult<{ assignedToId: string | null }>> {
  try {
    const parsed = assignSchema.safeParse({ assignedToId });
    if (!parsed.success) return actionFailure(parsed.error);
    const context = await requirePermission("leads.update");

    const previous = await context.db.lead.findUniqueOrThrow({
      where: { id: leadId, organizationId: context.organizationId },
    });

    const updated = await context.db.lead.update({
      where: { id: leadId, organizationId: context.organizationId },
      data: { assignedToId: parsed.data.assignedToId, lastActivityAt: new Date() },
      include: { assignedTo: { select: { id: true, name: true } } },
    });

    await context.db.leadActivity.create({
      data: {
        organizationId: context.organizationId,
        leadId,
        userId: context.user.id,
        type: "ASSIGNMENT_CHANGE",
        subject: parsed.data.assignedToId
          ? `Lead assigned to ${updated.assignedTo?.name ?? "agent"}`
          : "Lead unassigned",
      },
    });

    if (parsed.data.assignedToId) {
      await notifyUsers(
        {
          organizationId: context.organizationId,
          type: "LEAD_ASSIGNED",
          title: "New lead assigned to you",
        body: `${previous.firstName} ${previous.lastName} · ${previous.phone}`,
          link: `/crm/leads/${leadId}`,
          entityType: "Lead",
          entityId: leadId,
        },
        [parsed.data.assignedToId],
      );
    }

    revalidatePath(`/crm/leads/${leadId}`);
    revalidatePath(`/crm/leads`);
    return actionSuccess(
      { assignedToId: parsed.data.assignedToId },
      parsed.data.assignedToId ? `Lead assigned to ${updated.assignedTo?.name ?? "agent"}.` : "Lead unassigned.",
    );
  } catch (error) {
    return actionFailure(error);
  }
}

const scoreSchema = z.object({
  score: z.coerce.number().int().min(0).max(100),
  temperature: z.enum(LEAD_TEMPERATURE_VALUES),
});

export async function updateLeadScoreAction(
  leadId: string,
  input: { score: number; temperature: string },
): Promise<ActionResult<{ score: number }>> {
  try {
    const parsed = scoreSchema.safeParse(input);
    if (!parsed.success) return actionFailure(parsed.error);
    const context = await requirePermission("leads.update");

    await context.db.lead.update({
      where: { id: leadId, organizationId: context.organizationId },
      data: {
        score: parsed.data.score,
        temperature: parsed.data.temperature,
        lastActivityAt: new Date(),
      },
    });

    await context.db.leadActivity.create({
      data: {
        organizationId: context.organizationId,
        leadId,
        userId: context.user.id,
        type: "NOTE",
        subject: `Lead score updated to ${parsed.data.score} (${parsed.data.temperature})`,
      },
    });

    revalidatePath(`/crm/leads/${leadId}`);
    revalidatePath(`/crm/leads`);
    return actionSuccess({ score: parsed.data.score }, "Lead score updated.");
  } catch (error) {
    return actionFailure(error);
  }
}
