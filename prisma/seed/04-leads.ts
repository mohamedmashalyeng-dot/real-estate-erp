import { prisma } from "../../src/lib/prisma";

export async function seedCrmLeads(
  primeOrgId: string,
  userMap: Map<string, string>,
  campaigns: { metaId: string; googleId: string },
  projects: { celestiaId: string; skylineId: string },
) {
  console.log("-> Seeding CRM Leads & Follow-ups...");

  const ownerId = userMap.get("owner@primeestates.com")!;
  const karimId = userMap.get("karim.agent@primeestates.com")!;
  const laylaId = userMap.get("layla.agent@primeestates.com")!;

  const leadsData = [
    {
      firstName: "Hassan",
      lastName: "El-Shazly",
      email: "hassan.shazly@investegypt.com",
      phone: "+201201234567",
      country: "EG",
      city: "Cairo",
      budgetMin: "12000000.00",
      budgetMax: "26000000.00",
      stage: "WON" as const,
      source: "FACEBOOK" as const,
      campaignId: campaigns.metaId,
      preferredProjectId: projects.celestiaId,
      propertyType: "PENTHOUSE" as const,
      bedrooms: 4,
      assignedToId: karimId,
      score: 95,
      temperature: "HOT" as const,
      priorityCategory: "HOT" as const,
      priorityScore: 92,
      notes: "High-net-worth investor seeking luxury penthouse with skyline views. Cash ready.",
    },
    {
      firstName: "Mona",
      lastName: "Radwan",
      email: "mona.radwan@outlook.com",
      phone: "+201109876543",
      country: "EG",
      city: "Giza",
      budgetMin: "10000000.00",
      budgetMax: "14000000.00",
      stage: "RESERVATION" as const,
      source: "INSTAGRAM" as const,
      preferredProjectId: projects.celestiaId,
      propertyType: "APARTMENT" as const,
      bedrooms: 3,
      assignedToId: laylaId,
      score: 85,
      temperature: "HOT" as const,
      priorityCategory: "HOT" as const,
      priorityScore: 88,
      notes: "Reserved Unit CLST-A-202. Transferring reservation deposit.",
    },
    {
      firstName: "Ahmed",
      lastName: "Khashaba",
      email: "a.khashaba@fintech.io",
      phone: "+201099887766",
      country: "EG",
      city: "Alexandria",
      budgetMin: "8000000.00",
      budgetMax: "10000000.00",
      stage: "VIEWING" as const,
      source: "WEBSITE" as const,
      preferredProjectId: projects.celestiaId,
      propertyType: "APARTMENT" as const,
      bedrooms: 2,
      assignedToId: karimId,
      score: 75,
      temperature: "WARM" as const,
      priorityCategory: "WARM" as const,
      priorityScore: 78,
      notes: "Site visit scheduled for next Saturday at Celestia Hills sales center.",
    },
    {
      firstName: "Dina",
      lastName: "Helal",
      email: "dina.helal@designstudio.eg",
      phone: "+201088776655",
      country: "EG",
      city: "Cairo",
      budgetMin: "6000000.00",
      budgetMax: "8500000.00",
      stage: "QUALIFIED" as const,
      source: "GOOGLE" as const,
      campaignId: campaigns.googleId,
      preferredProjectId: projects.skylineId,
      propertyType: "OFFICE" as const,
      assignedToId: laylaId,
      score: 70,
      temperature: "WARM" as const,
      priorityCategory: "WARM" as const,
      priorityScore: 72,
      notes: "Looking for corporate headquarters for architectural consulting firm.",
    },
    {
      firstName: "Omar",
      lastName: "Ghonim",
      email: "omar.ghonim@yahoo.com",
      phone: "+201077665544",
      country: "EG",
      city: "Cairo",
      budgetMin: "15000000.00",
      budgetMax: "40000000.00",
      stage: "NEW" as const,
      source: "REFERRAL" as const,
      preferredProjectId: projects.celestiaId,
      propertyType: "VILLA" as const,
      bedrooms: 5,
      assignedToId: karimId,
      score: 60,
      temperature: "WARM" as const,
      priorityCategory: "WARM" as const,
      priorityScore: 65,
      notes: "Referred by Tarek Mansour. Inquiring about standalone villas in Celestia.",
    },
  ];

  const leadMap = new Map<string, string>();
  for (const l of leadsData) {
    const lead = await prisma.lead.create({
      data: {
        organizationId: primeOrgId,
        createdById: ownerId,
        ...l,
      },
    });
    leadMap.set(`${l.firstName} ${l.lastName}`, lead.id);

    await prisma.leadActivity.create({
      data: {
        organizationId: primeOrgId,
        leadId: lead.id,
        userId: lead.assignedToId,
        type: "NOTE",
        subject: "Lead Profiled",
        body: l.notes,
      },
    });

    await prisma.followUp.create({
      data: {
        organizationId: primeOrgId,
        leadId: lead.id,
        assignedToId: lead.assignedToId!,
        type: "CALL",
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: "PENDING",
        priority: l.temperature === "HOT" ? "URGENT" : "MEDIUM",
        notes: "Follow up on property requirements and coordinate site presentation.",
        createdById: ownerId,
      },
    });
  }

  return leadMap;
}