import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";

/**
 * In-app notifications. Created through the base client because notification
 * fan-out (for example "everyone with the finance role") legitimately spans
 * several memberships of the *same* organization.
 */

export type NotificationTypeValue =
  | "LEAD_ASSIGNED"
  | "FOLLOW_UP_DUE"
  | "FOLLOW_UP_OVERDUE"
  | "RESERVATION_EXPIRING"
  | "RESERVATION_EXPIRED"
  | "SALE_APPROVAL_REQUIRED"
  | "SALE_APPROVED"
  | "PAYMENT_DUE"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_RECEIVED"
  | "AI_INSIGHT"
  | "SYSTEM";

export interface NotifyInput {
  organizationId: string;
  type: NotificationTypeValue;
  title: string;
  body?: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export async function notifyUsers(
  input: NotifyInput,
  userIds: readonly string[],
): Promise<number> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return 0;

  // Only notify active members of the organization.
  const memberships = await prisma.membership.findMany({
    where: {
      organizationId: input.organizationId,
      status: "ACTIVE",
      userId: { in: uniqueIds },
    },
    select: { userId: true },
  });
  const recipients = memberships.map((membership) => membership.userId);
  if (recipients.length === 0) return 0;

  await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      organizationId: input.organizationId,
      userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
    })),
  });

  return recipients.length;
}

export async function notifyRole(
  input: NotifyInput,
  roleSlug: string | readonly string[],
): Promise<number> {
  const slugs = Array.isArray(roleSlug) ? roleSlug : [roleSlug];
  const memberships = await prisma.membership.findMany({
    where: {
      organizationId: input.organizationId,
      status: "ACTIVE",
      role: { slug: { in: [...slugs] } },
    },
    select: { userId: true },
  });
  return notifyUsers(
    input,
    memberships.map((membership) => membership.userId),
  );
}

export async function markNotificationRead(
  organizationId: string,
  userId: string,
  notificationId: string,
): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, organizationId, userId },
    data: { readAt: new Date() },
  });
  return result.count > 0;
}

export async function markAllNotificationsRead(
  organizationId: string,
  userId: string,
): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { organizationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
