import Link from "next/link";
import { notFound } from "next/navigation";
import { Calculator, CheckCircle2, Clock, FileSignature, KeyRound } from "lucide-react";
import { Badge, PageHeader, StatCard, Table, TableShell, TBody, TD, TH, THead, TR } from "@/components/ui/data-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganization } from "@/lib/context";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";

export const metadata = { title: "Reservations & Sales" };

export default async function SalesPage() {
  const context = await requireOrganization();
  if (!hasAnyPermission(context.permissions, ["reservations.view", "sales.view"])) notFound();

  const [reservations, sales, activeReservations, approvalQueue, contractedSales, salesTotal] = await Promise.all([
    context.db.reservation.findMany({
      orderBy: [{ status: "asc" }, { expiresAt: "asc" }],
      take: 80,
      include: {
        lead: { select: { id: true, firstName: true, lastName: true } },
        unit: { select: { unitCode: true } },
        salesperson: { select: { name: true } },
      },
    }),
    context.db.sale.findMany({
      orderBy: [{ saleDate: "desc" }],
      take: 80,
      include: {
        lead: { select: { id: true, firstName: true, lastName: true } },
        unit: { select: { unitCode: true } },
        salesperson: { select: { name: true } },
      },
    }),
    context.db.reservation.count({ where: { status: "ACTIVE" } }),
    context.db.sale.count({ where: { status: "PENDING_APPROVAL" } }),
    context.db.sale.count({ where: { status: { in: ["APPROVED", "CONTRACTED", "COMPLETED"] } } }),
    context.db.sale.aggregate({
      _sum: { contractValue: true },
      where: { status: { in: ["APPROVED", "CONTRACTED", "COMPLETED"] } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations & Sales"
        description="Track reservation holds, approval queues, contracted deals, and salesperson ownership."
        actions={
          hasPermission(context.permissions, "sales.view") ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/sales/calculator">
                <Calculator className="size-4" />
                <span>Payment Calculator</span>
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Reservations" value={formatNumber(activeReservations)} icon={KeyRound} />
        <StatCard label="Approval Queue" value={formatNumber(approvalQueue)} icon={Clock} />
        <StatCard label="Contracted Deals" value={formatNumber(contractedSales)} icon={CheckCircle2} />
        <StatCard label="Sales Volume" value={formatMoney(salesTotal._sum.contractValue, context.currency, { compact: true })} icon={FileSignature} />
      </div>

      <Card>
        <CardHeader><CardTitle>Reservations</CardTitle></CardHeader>
        <CardContent>
          <TableShell>
            <Table>
              <THead>
                <TR><TH>Lead</TH><TH>Unit</TH><TH>Status</TH><TH>Expires</TH><TH>Salesperson</TH><TH align="right">Amount</TH></TR>
              </THead>
              <TBody>
                {reservations.map((reservation) => (
                  <TR key={reservation.id}>
                    <TD>
                      <Link href={`/crm/leads/${reservation.lead.id}`} className="font-medium hover:text-primary">
                        {reservation.lead.firstName} {reservation.lead.lastName}
                      </Link>
                    </TD>
                    <TD>{reservation.unit.unitCode}</TD>
                    <TD><Badge tone={reservation.status === "ACTIVE" ? "warning" : reservation.status === "CONVERTED" ? "success" : "neutral"}>{reservation.status}</Badge></TD>
                    <TD>{formatDate(reservation.expiresAt)}</TD>
                    <TD>{reservation.salesperson.name}</TD>
                    <TD align="right">{formatMoney(reservation.amount, reservation.currency)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableShell>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sales</CardTitle></CardHeader>
        <CardContent>
          <TableShell>
            <Table>
              <THead>
                <TR><TH>Reference</TH><TH>Lead</TH><TH>Unit</TH><TH>Status</TH><TH>Date</TH><TH>Salesperson</TH><TH align="right">Contract</TH></TR>
              </THead>
              <TBody>
                {sales.map((sale) => (
                  <TR key={sale.id}>
                    <TD className="font-medium">{sale.reference}</TD>
                    <TD>
                      <Link href={`/crm/leads/${sale.lead.id}`} className="hover:text-primary">
                        {sale.lead.firstName} {sale.lead.lastName}
                      </Link>
                    </TD>
                    <TD>{sale.unit.unitCode}</TD>
                    <TD><Badge tone={sale.status === "COMPLETED" || sale.status === "CONTRACTED" ? "success" : sale.status === "PENDING_APPROVAL" ? "warning" : "neutral"}>{sale.status}</Badge></TD>
                    <TD>{formatDate(sale.saleDate)}</TD>
                    <TD>{sale.salesperson.name}</TD>
                    <TD align="right">{formatMoney(sale.contractValue, sale.currency)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableShell>
        </CardContent>
      </Card>
    </div>
  );
}
