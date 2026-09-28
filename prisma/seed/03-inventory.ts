import { prisma } from "../../src/lib/prisma";

export async function seedInventoryAndCampaigns(
  primeOrgId: string,
  userMap: Map<string, string>,
) {
  console.log("-> Seeding Marketing Campaigns & Projects...");

  const ownerId = userMap.get("owner@primeestates.com")!;
  const marketingId = userMap.get("marketing@primeestates.com");

  const metaCampaign = await prisma.campaign.create({
    data: {
      organizationId: primeOrgId,
      name: "Q4 Meta High-Net-Worth Villas",
      platform: "FACEBOOK",
      cost: "150000.00",
      currency: "EGP",
      startDate: new Date("2026-09-01"),
      status: "ACTIVE",
      createdById: marketingId,
    },
  });

  const googleCampaign = await prisma.campaign.create({
    data: {
      organizationId: primeOrgId,
      name: "Google Search - New Capital Commercial",
      platform: "GOOGLE",
      cost: "95000.00",
      currency: "EGP",
      startDate: new Date("2026-08-15"),
      status: "ACTIVE",
      createdById: marketingId,
    },
  });

  const celestiaProject = await prisma.project.create({
    data: {
      organizationId: primeOrgId,
      name: "Celestia Hills",
      code: "CLST",
      developer: "Prime Developments",
      locationCity: "New Cairo",
      locationCountry: "Egypt",
      address: "Golden Square, Fifth Settlement",
      description: "Ultra-luxury gated community with private crystal lagoons and lush landscaped parkways.",
      status: "UNDER_CONSTRUCTION",
      launchDate: new Date("2025-06-01"),
      expectedDeliveryDate: new Date("2028-12-31"),
      currency: "EGP",
      startingPrice: "8500000.00",
      totalUnits: 120,
      createdById: ownerId,
    },
  });

  const skylineProject = await prisma.project.create({
    data: {
      organizationId: primeOrgId,
      name: "Skyline Business Hub",
      code: "SKY",
      developer: "Prime Commercial",
      locationCity: "New Administrative Capital",
      locationCountry: "Egypt",
      address: "Central Business District, Sector B2",
      description: "Grade-A business complex directly overlooking the Green River and Iconic Tower.",
      status: "PLANNED",
      launchDate: new Date("2026-01-15"),
      expectedDeliveryDate: new Date("2029-06-30"),
      currency: "EGP",
      startingPrice: "6200000.00",
      totalUnits: 85,
      createdById: ownerId,
    },
  });

  const bldgA = await prisma.building.create({
    data: {
      organizationId: primeOrgId,
      projectId: celestiaProject.id,
      name: "Building A - The Jade",
      code: "CLST-A",
      floors: 5,
    },
  });

  const bldgB = await prisma.building.create({
    data: {
      organizationId: primeOrgId,
      projectId: celestiaProject.id,
      name: "Building B - The Onyx",
      code: "CLST-B",
      floors: 6,
    },
  });

  const unitsData = [
    {
      unitCode: "CLST-A-101",
      buildingId: bldgA.id,
      projectId: celestiaProject.id,
      floor: 1,
      type: "APARTMENT" as const,
      bedrooms: 2,
      bathrooms: 2,
      areaSqm: "135.00",
      price: "9100000.00",
      status: "AVAILABLE" as const,
      view: "GARDEN" as const,
      finishing: "FULLY_FINISHED" as const,
    },
    {
      unitCode: "CLST-A-202",
      buildingId: bldgA.id,
      projectId: celestiaProject.id,
      floor: 2,
      type: "APARTMENT" as const,
      bedrooms: 3,
      bathrooms: 3,
      areaSqm: "185.50",
      price: "12800000.00",
      status: "RESERVED" as const,
      view: "POOL" as const,
      finishing: "FULLY_FINISHED" as const,
    },
    {
      unitCode: "CLST-A-PH1",
      buildingId: bldgA.id,
      projectId: celestiaProject.id,
      floor: 5,
      type: "PENTHOUSE" as const,
      bedrooms: 4,
      bathrooms: 5,
      areaSqm: "320.00",
      price: "24500000.00",
      status: "SOLD" as const,
      view: "LANDSCAPE" as const,
      finishing: "FULLY_FINISHED" as const,
    },
    {
      unitCode: "CLST-B-101",
      buildingId: bldgB.id,
      projectId: celestiaProject.id,
      floor: 1,
      type: "DUPLEX" as const,
      bedrooms: 4,
      bathrooms: 4,
      areaSqm: "260.00",
      price: "17200000.00",
      status: "AVAILABLE" as const,
      view: "GARDEN" as const,
      finishing: "SEMI_FINISHED" as const,
    },
    {
      unitCode: "CLST-V-12",
      projectId: celestiaProject.id,
      floor: 0,
      type: "VILLA" as const,
      bedrooms: 5,
      bathrooms: 6,
      areaSqm: "480.00",
      price: "38500000.00",
      status: "AVAILABLE" as const,
      view: "LANDSCAPE" as const,
      finishing: "CORE_SHELL" as const,
    },
    {
      unitCode: "SKY-OFF-301",
      projectId: skylineProject.id,
      floor: 3,
      type: "OFFICE" as const,
      bedrooms: 0,
      bathrooms: 2,
      areaSqm: "110.00",
      price: "7700000.00",
      status: "AVAILABLE" as const,
      view: "CITY" as const,
      finishing: "FULLY_FINISHED" as const,
    },
  ];

  const unitMap = new Map<string, string>();
  for (const u of unitsData) {
    const row = await prisma.unit.create({
      data: {
        organizationId: primeOrgId,
        createdById: ownerId,
        ...u,
      },
    });
    unitMap.set(u.unitCode, row.id);
  }

  return {
    metaCampaign,
    googleCampaign,
    celestiaProject,
    skylineProject,
    unitMap,
  };
}