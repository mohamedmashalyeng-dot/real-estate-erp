import { prisma } from "../../src/lib/prisma";

export async function seedUsersAndMemberships(
  primeOrgId: string,
  redSeaOrgId: string,
  passwordHash: string,
) {
  console.log("-> Seeding Team Members for Prime Estates...");

  const primeRoles = await prisma.role.findMany({
    where: { organizationId: primeOrgId },
  });
  const roleBySlug = new Map(primeRoles.map((r) => [r.slug, r.id]));

  const teamMembers = [
    {
      email: "owner@primeestates.com",
      name: "Tarek Mansour",
      role: "owner",
      title: "Managing Director & Founder",
      phone: "+201011112222",
    },
    {
      email: "sales.director@primeestates.com",
      name: "Nadine El-Gammal",
      role: "sales_manager",
      title: "Head of Residential Sales",
      phone: "+201022223333",
    },
    {
      email: "karim.agent@primeestates.com",
      name: "Karim Zaki",
      role: "sales",
      title: "Senior Property Advisor",
      phone: "+201033334444",
    },
    {
      email: "layla.agent@primeestates.com",
      name: "Layla Fahmy",
      role: "sales",
      title: "Property Consultant",
      phone: "+201044445555",
    },
    {
      email: "finance@primeestates.com",
      name: "Amr Sherif",
      role: "finance",
      title: "Chief Financial Officer",
      phone: "+201055556666",
    },
    {
      email: "marketing@primeestates.com",
      name: "Salma Youssef",
      role: "marketing",
      title: "Growth & Performance Lead",
      phone: "+201066667777",
    },
  ];

  const userRecordMap = new Map<string, string>();

  for (const m of teamMembers) {
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: { passwordHash, phone: m.phone, jobTitle: m.title },
      create: {
        email: m.email,
        name: m.name,
        passwordHash,
        phone: m.phone,
        jobTitle: m.title,
        status: "ACTIVE",
      },
    });

    userRecordMap.set(m.email, user.id);

    const rId = roleBySlug.get(m.role)!;
    await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: primeOrgId,
        },
      },
      update: { roleId: rId },
      create: {
        userId: user.id,
        organizationId: primeOrgId,
        roleId: rId,
        status: "ACTIVE",
        isPrimary: m.role === "owner",
      },
    });
  }

  // Also assign Owner membership in Red Sea Horizons to test org switching
  const ownerUserId = userRecordMap.get("owner@primeestates.com")!;
  const redSeaOwnerRole = await prisma.role.findFirstOrThrow({
    where: { organizationId: redSeaOrgId, slug: "owner" },
  });
  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: ownerUserId,
        organizationId: redSeaOrgId,
      },
    },
    update: { roleId: redSeaOwnerRole.id },
    create: {
      userId: ownerUserId,
      organizationId: redSeaOrgId,
      roleId: redSeaOwnerRole.id,
      status: "ACTIVE",
      isPrimary: false,
    },
  });

  return userRecordMap;
}