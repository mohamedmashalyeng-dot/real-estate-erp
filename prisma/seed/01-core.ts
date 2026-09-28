import "dotenv/config";
import { prisma } from "../../src/lib/prisma";
import { ALL_PERMISSION_KEYS, SYSTEM_ROLES, PERMISSIONS } from "../../src/lib/permissions";

export async function seedCoreIdentity(passwordHash: string) {
  console.log("-> Seeding RBAC permissions catalogue...");
  for (const key of ALL_PERMISSION_KEYS) {
    const meta = PERMISSIONS[key];
    await prisma.permission.upsert({
      where: { key },
      update: { label: meta.label, module: meta.module },
      create: { key, label: meta.label, module: meta.module },
    });
  }
  const allDbPermissions = await prisma.permission.findMany();
  const permMap = new Map(allDbPermissions.map((p) => [p.key, p.id]));

  console.log("-> Seeding Platform Admin...");
  await prisma.user.upsert({
    where: { email: "admin@estateiq.io" },
    update: { passwordHash },
    create: {
      email: "admin@estateiq.io",
      name: "EstateIQ Super Admin",
      passwordHash,
      isPlatformAdmin: true,
      status: "ACTIVE",
      jobTitle: "Chief Platform Architect",
    },
  });

  console.log("-> Seeding Organizations...");
  const primeOrg = await prisma.organization.upsert({
    where: { slug: "prime-estates" },
    update: {},
    create: {
      name: "Prime Estates Egypt",
      slug: "prime-estates",
      legalName: "Prime Real Estate Investment & Developments S.A.E.",
      country: "EG",
      timezone: "Africa/Cairo",
      currency: "EGP",
      status: "ACTIVE",
      plan: "ENTERPRISE",
      aiEnabled: true,
      settings: {
        create: {
          leadSlaHours: 12,
          defaultFollowUpType: "CALL",
          autoCreateFollowUpOnNewLead: true,
          aiMonthlyTokenBudget: 1000000,
        },
      },
    },
  });

  const redSeaOrg = await prisma.organization.upsert({
    where: { slug: "red-sea-horizons" },
    update: {},
    create: {
      name: "Red Sea Horizons",
      slug: "red-sea-horizons",
      legalName: "Red Sea Hospitality & Living S.A.E.",
      country: "EG",
      timezone: "Africa/Cairo",
      currency: "USD",
      status: "ACTIVE",
      plan: "PROFESSIONAL",
      aiEnabled: true,
      settings: {
        create: {
          leadSlaHours: 24,
          defaultFollowUpType: "WHATSAPP",
          autoCreateFollowUpOnNewLead: true,
          aiMonthlyTokenBudget: 500000,
        },
      },
    },
  });

  console.log("-> Seeding System Roles for organizations...");
  for (const org of [primeOrg, redSeaOrg]) {
    for (const roleDef of SYSTEM_ROLES) {
      const role = await prisma.role.upsert({
        where: {
          organizationId_slug: {
            organizationId: org.id,
            slug: roleDef.slug,
          },
        },
        update: {
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
        },
        create: {
          organizationId: org.id,
          slug: roleDef.slug,
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
        },
      });

      for (const pKey of roleDef.permissions) {
        const pId = permMap.get(pKey);
        if (pId) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: { roleId: role.id, permissionId: pId },
            },
            update: {},
            create: { roleId: role.id, permissionId: pId },
          });
        }
      }
    }
  }

  return { primeOrg, redSeaOrg };
}
