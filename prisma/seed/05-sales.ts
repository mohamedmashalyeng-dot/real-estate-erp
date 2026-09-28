import { prisma } from "../../src/lib/prisma";

export async function seedSalesAndFinance(
  primeOrgId: string,
  userMap: Map<string, string>,
  leadMap: Map<string, string>,
  unitMap: Map<string, string>,
) {
  console.log("-> Seeding Reservations, Sales, Payment Plans & Logs...");

  const ownerId = userMap.get("owner@primeestates.com")!;
  const karimId = userMap.get("karim.agent@primeestates.com")!;
  const laylaId = userMap.get("layla.agent@primeestates.com")!;
  const financeId = userMap.get("finance@primeestates.com")!;

  // 1. Reservation for Mona Radwan on CLST-A-202
  const monaLeadId = leadMap.get("Mona Radwan")!;
  const unit202Id = unitMap.get("CLST-A-202")!;
  await prisma.reservation.create({
    data: {
      organizationId: primeOrgId,
      leadId: monaLeadId,
      unitId: unit202Id,
      salespersonId: laylaId,
      amount: "100000.00",
      currency: "EGP",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      notes: "Holding deposit pending contract signing.",
      createdById: laylaId,
    },
  });

  // 2. Won Sale for Hassan El-Shazly on CLST-A-PH1
  const hassanLeadId = leadMap.get("Hassan El-Shazly")!;
  const penthouseUnitId = unitMap.get("CLST-A-PH1")!;
  const sale = await prisma.sale.create({
    data: {
      organizationId: primeOrgId,
      reference: "SALE-2026-001",
      leadId: hassanLeadId,
      unitId: penthouseUnitId,
      salespersonId: karimId,
      salePrice: "24500000.00",
      discount: "500000.00",
      contractValue: "24000000.00",
      currency: "EGP",
      commissionRate: "2.00",
      commissionAmount: "480000.00",
      saleDate: new Date("2026-09-15"),
      status: "CONTRACTED",
      approvedById: ownerId,
      approvedAt: new Date("2026-09-16"),
      notes: "Contract signed at company HQ. 10% down payment received.",
      createdById: karimId,
    },
  });

  // 3. Payment Plan: 10% down payment (2.4M) + 8 quarterly installments of 2.7M
  const plan = await prisma.paymentPlan.create({
    data: {
      organizationId: primeOrgId,
      saleId: sale.id,
      totalAmount: "24000000.00",
      downPayment: "2400000.00",
      installmentsCount: 8,
      startDate: new Date("2026-09-15"),
      currency: "EGP",
      notes: "2-year quarterly equal installments plan.",
      createdById: financeId,
    },
  });

  // Down Payment payment record
  await prisma.payment.create({
    data: {
      organizationId: primeOrgId,
      saleId: sale.id,
      leadId: hassanLeadId,
      amount: "2400000.00",
      currency: "EGP",
      paidAt: new Date("2026-09-15"),
      method: "BANK_TRANSFER",
      reference: "CIB-TRF-994821",
      notes: "10% contract down payment via CIB transfer.",
      receivedById: financeId,
    },
  });

  // Installments schedule
  const installmentAmount = (24000000 - 2400000) / 8; // 2,700,000 each
  for (let i = 1; i <= 8; i++) {
    const dueDate = new Date("2026-09-15");
    dueDate.setMonth(dueDate.getMonth() + i * 3);

    await prisma.installment.create({
      data: {
        organizationId: primeOrgId,
        paymentPlanId: plan.id,
        sequence: i,
        amount: installmentAmount.toFixed(2),
        dueDate,
        status: i === 1 ? "DUE" : "UPCOMING",
      },
    });
  }

  // 4. Notifications & Audit Logs
  await prisma.notification.create({
    data: {
      organizationId: primeOrgId,
      userId: karimId,
      type: "SALE_APPROVED",
      title: "Sale Approved: SALE-2026-001",
      body: "Penthouse sale for Hassan El-Shazly has been approved and contracted.",
      link: "/sales",
      entityType: "Sale",
      entityId: sale.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: primeOrgId,
      userId: ownerId,
      actorEmail: "owner@primeestates.com",
      action: "SALE_APPROVE",
      entityType: "Sale",
      entityId: sale.id,
      metadata: { contractValue: "24000000.00", reference: "SALE-2026-001" },
    },
  });
}