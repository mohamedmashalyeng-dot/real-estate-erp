import { requireOrganization } from "@/lib/context";
import { PageHeader, StatCard } from "@/components/ui/data-display";
import { formatMoney, formatNumber } from "@/lib/format";
import { Users, Building, KeyRound, Receipt } from "lucide-react";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const { db, currency, membership } = await requireOrganization();

  // Run initial dashboard KPI aggregates tenant-scoped
  const [totalLeads, openLeads, totalUnits, availableUnits, totalSales, activeReservations] =
    await Promise.all([
      db.lead.count(),
      db.lead.count({
        where: {
          stage: {
            in: ["NEW", "CONTACTED", "QUALIFIED", "VIEWING", "NEGOTIATION", "RESERVATION"],
          },
        },
      }),
      db.unit.count(),
      db.unit.count({ where: { status: "AVAILABLE" } }),
      db.sale.aggregate({
        _sum: { contractValue: true },
        where: { status: { in: ["APPROVED", "CONTRACTED", "COMPLETED"] } },
      }),
      db.reservation.count({ where: { status: "ACTIVE" } }),
    ]);

  const salesVolume = totalSales._sum.contractValue?.toString() ?? "0";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome to ${membership.organizationName}`}
        description="Operational overview across CRM pipeline, inventory availability, sales contracts and cash collections."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Leads"
          value={formatNumber(openLeads)}
          hint={`${totalLeads} lifetime leads`}
          icon={Users}
        />
        <StatCard
          label="Available Inventory"
          value={formatNumber(availableUnits)}
          hint={`${totalUnits} total units in portfolio`}
          icon={Building}
        />
        <StatCard
          label="Active Reservations"
          value={formatNumber(activeReservations)}
          hint="Pending contract execution"
          icon={KeyRound}
        />
        <StatCard
          label="Contracted Sales"
          value={formatMoney(salesVolume, currency, { compact: true })}
          hint="Executed sales volume"
          icon={Receipt}
        />
      </div>
    </div>
  );
}