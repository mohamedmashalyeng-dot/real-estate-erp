import Link from "next/link";
import { notFound } from "next/navigation";
import { Banknote, CalendarClock, CheckCircle2, Receipt } from "lucide-react";
import { Badge, PageHeader, StatCard, Table, TableShell, TBody, TD, TH, THead, TR } from "@/components/ui/data-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganization } from "@/lib/context";
import { hasAnyPermission } from "@/lib/permissions";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";

export const metadata = { title: "Finance & Installments" };

export default async function InstallmentsPage() {
  const context = await requireOrganization();
  if (!hasAnyPermission(context.permissions, ["payments.view", "collections.view"])) notFound();

  const [installments, payments, dueCount, overdueCount, paidCount, paidTotal] = await Promise.all([
    context.db.installment.findMany({
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      take: 100,
      include: { paymentPlan: { include: { sale: { include: { lead: true } } } } },
    }),
    context.db.payment.findMany({
      orderBy: { paidAt: "desc" },
      take: 60,
      include: { sale: { select: { reference: true } }, receivedBy: { select: { name: true } } },
    }),
    context.db.installment.count({ where: { status: "DUE" } }),
    context.db.installment.count({ where: { status: "OVERDUE" } }),
    context.db.installment.count({ where: { status: "PAID" } }),
    context.db.payment.aggregate({ _sum: { amount: true } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance & Installments"
        description="Payment schedules, due installments, received collections, and contract finance status."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Due" value={formatNumber(dueCount)} icon={CalendarClock} />
        <StatCard label="Overdue" value={formatNumber(overdueCount)} icon={Receipt} />
        <StatCard label="Paid Installments" value={formatNumber(paidCount)} icon={CheckCircle2} />
        <StatCard label="Collected" value={formatMoney(paidTotal._sum.amount, context.currency, { compact: true })} icon={Banknote} />
      </div>

      <Card>
        <CardHeader><CardTitle>Installment Schedule</CardTitle></CardHeader>
        <CardContent>
          <TableShell>
            <Table>
              <THead>
                <TR><TH>Sale</TH><TH>Lead</TH><TH>Seq.</TH><TH>Due date</TH><TH>Status</TH><TH align="right">Paid</TH><TH align="right">Amount</TH></TR>
              </THead>
              <TBody>
                {installments.map((installment) => (
                  <TR key={installment.id}>
                    <TD className="font-medium">{installment.paymentPlan.sale.reference}</TD>
                    <TD>
                      <Link href={`/crm/leads/${installment.paymentPlan.sale.lead.id}`} className="hover:text-primary">
                        {installment.paymentPlan.sale.lead.firstName} {installment.paymentPlan.sale.lead.lastName}
                      </Link>
                    </TD>
                    <TD>{installment.sequence}</TD>
                    <TD>{formatDate(installment.dueDate)}</TD>
                    <TD><Badge tone={installment.status === "PAID" ? "success" : installment.status === "OVERDUE" ? "danger" : "warning"}>{installment.status}</Badge></TD>
                    <TD align="right">{formatMoney(installment.paidAmount, installment.paymentPlan.currency)}</TD>
                    <TD align="right">{formatMoney(installment.amount, installment.paymentPlan.currency)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableShell>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Payments</CardTitle></CardHeader>
        <CardContent>
          <TableShell>
            <Table>
              <THead>
                <TR><TH>Date</TH><TH>Sale</TH><TH>Method</TH><TH>Reference</TH><TH>Received by</TH><TH align="right">Amount</TH></TR>
              </THead>
              <TBody>
                {payments.map((payment) => (
                  <TR key={payment.id}>
                    <TD>{formatDate(payment.paidAt)}</TD>
                    <TD className="font-medium">{payment.sale.reference}</TD>
                    <TD>{payment.method}</TD>
                    <TD>{payment.reference ?? "-"}</TD>
                    <TD>{payment.receivedBy?.name ?? "-"}</TD>
                    <TD align="right">{formatMoney(payment.amount, payment.currency)}</TD>
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
