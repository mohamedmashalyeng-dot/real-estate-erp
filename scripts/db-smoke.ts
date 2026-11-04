/**
 * Temporary end-to-end smoke check for the data layer:
 *   - Prisma 7 driver adapter against the local MariaDB server
 *   - tenant guard injection + fail-closed cross-tenant blocking
 *   - Decimal / enum / uuid(7) round-trips
 *
 * Usage: npx tsx scripts/db-smoke.ts
 */
import "dotenv/config";
import { forOrganization, prisma } from "../src/lib/prisma";
import { TenantIsolationError } from "../src/lib/tenant";

async function main() {
  const suffix = Date.now().toString(36);

  const orgA = await prisma.organization.create({
    data: { name: `Smoke A ${suffix}`, slug: `smoke-a-${suffix}`, currency: "EGP" },
  });
  const orgB = await prisma.organization.create({
    data: { name: `Smoke B ${suffix}`, slug: `smoke-b-${suffix}`, currency: "USD" },
  });

  const dbA = forOrganization(orgA.id);
  const dbB = forOrganization(orgB.id);

  const project = await dbA.project.create({
    data: {
      organizationId: orgA.id,
      name: `Smoke Project ${suffix}`,
      status: "PLANNED",
      currency: "EGP",
      startingPrice: "1500000.00",
    },
  });

  const unit = await dbA.unit.create({
    data: {
      organizationId: orgA.id,
      projectId: project.id,
      unitCode: `SMK-${suffix}-1`,
      type: "APARTMENT",
      bedrooms: 2,
      bathrooms: 2,
      areaSqm: "120.50",
      price: "4250000.75",
      status: "AVAILABLE",
    },
  });

  const lead = await dbA.lead.create({
    data: {
      organizationId: orgA.id,
      firstName: "Smoke",
      lastName: "Tester",
      phone: "+201000000000",
      stage: "QUALIFIED",
      source: "WEBSITE",
      budgetMin: "3000000.00",
      budgetMax: "5000000.00",
      propertyType: "APARTMENT",
      bedrooms: 2,
    },
  });

  const leadsInA = await dbA.lead.count();
  const leadsInB = await dbB.lead.count();
  const unitsInB = await dbB.unit.count();

  let blocked = false;
  try {
    await dbB.lead.findMany({ where: { organizationId: orgA.id } });
  } catch (error) {
    blocked = error instanceof TenantIsolationError;
  }

  const crossRead = await dbB.lead.findMany({ where: { id: lead.id } });

  console.log("org A lead count      :", leadsInA, "(expected 1)");
  console.log("org B lead count      :", leadsInB, "(expected 0)");
  console.log("org B unit count      :", unitsInB, "(expected 0)");
  console.log("cross-tenant filter   :", blocked ? "BLOCKED" : "NOT BLOCKED (!!)");
  console.log("cross-tenant id read  :", crossRead.length, "(expected 0)");
  console.log("unit price (Decimal)  :", unit.price.toString());
  console.log("lead budget min       :", lead.budgetMin?.toString());
  console.log("project org id        :", project.organizationId === orgA.id ? "injected" : "MISSING");

  await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  console.log("cleanup               : done");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
