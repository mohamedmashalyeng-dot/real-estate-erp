/**
 * Creates the first real organization and its owner on an empty production
 * database (the demo seed is not safe there: it uses a shared password).
 *
 * Driven by environment variables:
 *   BOOTSTRAP_ORG_NAME        e.g. "WEST Development"            (required)
 *   BOOTSTRAP_OWNER_EMAIL     owner login                         (required)
 *   BOOTSTRAP_OWNER_PASSWORD  at least 12 characters              (required)
 *   BOOTSTRAP_OWNER_NAME      display name                        (default "Owner")
 *   BOOTSTRAP_ORG_CURRENCY    ISO code                            (default "EGP")
 *   BOOTSTRAP_ORG_TIMEZONE    IANA zone                           (default "Africa/Cairo")
 *
 * Does nothing when BOOTSTRAP_OWNER_EMAIL is unset. Safe to re-run: existing
 * rows are kept, and an existing user's password is never changed.
 *
 * Usage: npm run db:bootstrap
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { seedPermissionCatalogue, seedSystemRoles } from "../prisma/seed/01-core";

function setting(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const email = setting("BOOTSTRAP_OWNER_EMAIL")?.toLowerCase();
  if (!email) {
    console.log("[bootstrap] BOOTSTRAP_OWNER_EMAIL is not set; skipping.");
    return;
  }
  const orgName = setting("BOOTSTRAP_ORG_NAME");
  const password = setting("BOOTSTRAP_OWNER_PASSWORD");
  if (!orgName) throw new Error("BOOTSTRAP_ORG_NAME is required.");
  if (!password || password.length < 12) {
    throw new Error("BOOTSTRAP_OWNER_PASSWORD is required and must be at least 12 characters.");
  }
  const slug = slugify(orgName);
  if (!slug) throw new Error("BOOTSTRAP_ORG_NAME must contain letters or digits.");

  const permMap = await seedPermissionCatalogue();

  const organization = await prisma.organization.upsert({
    where: { slug },
    update: {},
    create: {
      name: orgName,
      slug,
      currency: setting("BOOTSTRAP_ORG_CURRENCY") ?? "EGP",
      timezone: setting("BOOTSTRAP_ORG_TIMEZONE") ?? "Africa/Cairo",
      status: "ACTIVE",
      settings: { create: {} },
    },
  });
  await seedSystemRoles(organization.id, permMap);
  const ownerRole = await prisma.role.findUniqueOrThrow({
    where: { organizationId_slug: { organizationId: organization.id, slug: "owner" } },
  });

  const existingUser = await prisma.user.findUnique({ where: { email } });
  const user =
    existingUser ??
    (await prisma.user.create({
      data: {
        email,
        name: setting("BOOTSTRAP_OWNER_NAME") ?? "Owner",
        passwordHash: await bcrypt.hash(password, 10),
        status: "ACTIVE",
      },
    }));

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
    update: {},
    create: {
      userId: user.id,
      organizationId: organization.id,
      roleId: ownerRole.id,
      status: "ACTIVE",
      isPrimary: true,
    },
  });

  console.log(
    `[bootstrap] ${organization.name} (${slug}) ready; owner ${email}${existingUser ? " (existing user, password unchanged)" : " created"}.`,
  );
}

main()
  .catch((error) => {
    console.error("[bootstrap] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
