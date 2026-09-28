import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { seedCoreIdentity } from "./seed/01-core";
import { seedUsersAndMemberships } from "./seed/02-users";
import { seedInventoryAndCampaigns } from "./seed/03-inventory";
import { seedCrmLeads } from "./seed/04-leads";
import { seedSalesAndFinance } from "./seed/05-sales";

async function main() {
  console.log("🌱 Starting EstateIQ database seed...");

  const passwordHash = await bcrypt.hash("Password123!", 10);

  // 1. Permissions, Platform Admin, and Organizations
  const { primeOrg, redSeaOrg } = await seedCoreIdentity(passwordHash);

  // 2. Users and Multi-Tenant Memberships
  const userMap = await seedUsersAndMemberships(primeOrg.id, redSeaOrg.id, passwordHash);

  // 3. Campaigns, Projects, Buildings, and Units
  const inventory = await seedInventoryAndCampaigns(primeOrg.id, userMap);

  // 4. CRM Leads and Activities
  const leadMap = await seedCrmLeads(
    primeOrg.id,
    userMap,
    { metaId: inventory.metaCampaign.id, googleId: inventory.googleCampaign.id },
    { celestiaId: inventory.celestiaProject.id, skylineId: inventory.skylineProject.id },
  );

  // 5. Sales, Reservations, Payment Plans, Payments, and Notifications
  await seedSalesAndFinance(primeOrg.id, userMap, leadMap, inventory.unitMap);

  console.log("✅ Seed completed successfully!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🏢 Organizations : Prime Estates (EGP), Red Sea Horizons (USD)");
  console.log("🔑 Demo Login    : owner@primeestates.com / Password123!");
  console.log("👤 Sales Agent   : karim.agent@primeestates.com / Password123!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });