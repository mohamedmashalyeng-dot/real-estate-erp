import { createHmac } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { env } from "./env";

const WINDOW_MS = 15 * 60_000;
export const LOGIN_ATTEMPT_LIMIT = 8;
const credentialsSchema = z.object({ email: z.string().trim().toLowerCase().max(191).pipe(z.email()), password: z.string().min(1).max(256) });
const dummyHash = bcrypt.hashSync("unknown-account-placeholder", 10);

/** Durable across workers/restarts. Uses the existing audit index; no new schema. */
export async function consumeLoginAttempt(email: string, now = new Date()): Promise<boolean> {
  const key = createHmac("sha256", env.authSecret).update(email.trim().toLowerCase()).digest("hex");
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const where = { organizationId: null, entityType: "LoginGuard", entityId: key, action: "AUTH_LOGIN_ATTEMPT", createdAt: { gte: new Date(now.getTime() - WINDOW_MS) } };
        if (await tx.auditLog.count({ where }) >= LOGIN_ATTEMPT_LIMIT) return false;
        await tx.auditLog.create({ data: { organizationId: null, entityType: "LoginGuard", entityId: key, action: "AUTH_LOGIN_ATTEMPT", createdAt: now } });
        return true;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 5000 });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034" || attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 15 * (attempt + 1)));
    }
  }
  return false;
}

export class LoginRateLimitError extends Error {}

export async function authorizeCredentials(input: unknown) {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return null;
  if (!await consumeLoginAttempt(parsed.data.email)) throw new LoginRateLimitError();
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Unknown and inactive accounts still perform a password comparison.
  const matches = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? dummyHash);
  if (!user || user.status !== "ACTIVE" || !matches) return null;
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { id: user.id, name: user.name, email: user.email, image: user.image, isPlatformAdmin: user.isPlatformAdmin };
}
