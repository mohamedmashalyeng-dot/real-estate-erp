import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";

/**
 * Audit trail. Writes are best-effort: a failed audit write must never break
 * the business operation that triggered it, and secrets never get persisted.
 */

const REDACTED_KEYS = new Set([
  "password",
  "passwordHash",
  "password_hash",
  "token",
  "tokenHash",
  "token_hash",
  "secret",
  "authorization",
  "apiKey",
  "api_key",
  "cookie",
]);

export function redactSensitive(
  value: Record<string, unknown> | undefined | null,
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      output[key] = "[redacted]";
      continue;
    }
    if (entry && typeof entry === "object" && !Array.isArray(entry) && !(entry instanceof Date)) {
      output[key] = redactSensitive(entry as Record<string, unknown>);
      continue;
    }
    output[key] = entry;
  }
  return output;
}

export interface AuditInput {
  organizationId?: string | null;
  userId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const cleanedMetadata = redactSensitive(input.metadata);
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId ?? null,
        userId: input.userId ?? null,
        actorEmail: input.actorEmail ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: (cleanedMetadata as Prisma.InputJsonValue) ?? undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] failed to persist audit entry", {
      action: input.action,
      entityType: input.entityType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
