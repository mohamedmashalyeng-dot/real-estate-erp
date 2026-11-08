import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Banknote, Receipt, Wallet } from "lucide-react";
import { Badge, DefinitionList, EmptyState, PageHeader, StatCard, Table, TableShell, TBody, TD, TH, THead, TR } from "@/components/ui/data-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganization } from "@/lib/context";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { formatDate, formatMoney, formatPercent, titleCase } from "@/lib/format";
import { daysOverdue, fromCents, remainingCents, syncInstallmentStatuses, toCents } from "@/lib/collections";
import { RecordPaymentDialog } from "../../record-payment-dialog";
import { PrintButton } from "../../print-button";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Statement ${id.slice(0, 8)}` };
}

export default async function SaleStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireOrganization();
  if (!hasAnyPermission(context.permissions, ["payments.view", "collections.view", "sales.view"])) notFound();
  const canRecord = hasPermission(context.permissions, "payments.create");

  const now = new Date();
  await syncInstallmentStatuses(context.db, now);

  const sale = await context.db.sale.findUnique({
    where: { id },
    include: {
      lead: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      unit: { select: { unitCode: true, type: true, areaSqm: true, project: { select: { name: true } } } },
      salesperson: { select: { name: true } },
      paymentPlan: { include: { installments: { orderBy: { sequence: "asc" } } } },
      payments: {
        orderBy: { paidAt: "asc" },
        include: { installment: { select: { sequence: true } }, receivedBy: { select: { name: true } } },
      },
    },
  });
  if (!sale) notFound();

  const currency = sale.currency;
  const installments = sale.paymentPlan?.installments ?? [];
  const contractCents = toCents(sale.contractValue);
  const paidCents = sale.payments.reduce((sum, payment) => sum + toCents(payment.amount), 0);
  const balanceCents = Math.max(0, contractCents - paidCents);
  const overdue = installments.filter((entry) => entry.status === "OVERDUE");
  const overdueCents = overdue.reduce((sum, entry) => sum + remainingCents(entry), 0);
  const nextDue = installments.find((entry) => entry.status !== "PAID" && entry.status !== "OVERDUE");
  const scheduledCents = installments.reduce((sum, entry) => sum + toCents(entry.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Finance", href: "/finance/installments" }, { label: sale.reference }]}
        title={`Customer statement · ${sale.reference}`}
        description={`${sale.lead.firstName} ${sale.lead.lastName} · ${sale.unit.project.name} · unit ${sale.unit.unitCode}`}
        actions={<PrintButton />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Contract value" value={formatMoney(sale.contractValue, currency)} icon={Receipt} />
        <StatCard
          label="Paid to date"
          value={formatMoney(fromCents(paidCents), currency)}
          hint={contractCents ? `${formatPercent((paidCents / contractCents) * 100)} of contract` : undefined}
          icon={Banknote}
        />
        <StatCard label="Remaining balance" value={formatMoney(fromCents(balanceCents), currency)} icon={Wallet} />
        <StatCard
          label="Overdue"
          value={formatMoney(fromCents(overdueCents), currency)}
          hint={overdue.length ? `${overdue.length} installments late` : "Nothing overdue"}
          icon={AlertTriangle}
        />
      </div>

      <Card>
        <CardHeader><CardTitle>Contract</CardTitle></CardHeader>
        <CardContent>
          <DefinitionList
            className="lg:grid-cols-4"
            items={[
              { label: "Customer", value: <Link href={`/crm/leads/${sale.lead.id}`} className="hover:text-primary">{sale.lead.firstName} {sale.lead.lastName}</Link> },
              { label: "Phone", value: sale.lead.phone },
              { label: "Unit", value: `${sale.unit.unitCode} · ${titleCase(sale.unit.type)} · ${sale.unit.areaSqm.toString()} m²` },
              { label: "Salesperson", value: sale.salesperson.name },
              { label: "Sale date", value: formatDate(sale.saleDate) },
              { label: "Status", value: <Badge tone={sale.status === "CANCELLED" ? "danger" : "primary"}>{sale.status}</Badge> },
              { label: "Price / discount", value: `${formatMoney(sale.salePrice, currency)} / ${formatMoney(sale.discount, currency)}` },
              { label: "Next due", value: nextDue ? `${formatDate(nextDue.dueDate)} · ${formatMoney(fromCents(remainingCents(nextDue)), currency)}` : "-" },
            ]}
          />
          {sale.paymentPlan?.notes ? <p className="mt-4 text-xs text-muted-foreground">{sale.paymentPlan.notes}</p> : null}
          {installments.length > 0 && scheduledCents !== contractCents ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-warning">
              Installments total {formatMoney(fromCents(scheduledCents), currency)}; the rest of the contract value is the down payment / contract instalment.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Installments</CardTitle></CardHeader>
        <CardContent>
          {installments.length === 0 ? (
            <EmptyState
              title="No payment plan yet"
              description="Create one from the payment calculator to start tracking installments."
            />
          ) : (
            <TableShell>
              <Table>
                <THead>
                  <TR>
                    <TH>#</TH><TH>Due date</TH><TH>Status</TH><TH align="right">Amount</TH><TH align="right">Paid</TH>
                    <TH align="right">Remaining</TH>{canRecord ? <TH className="print:hidden" /> : null}
                  </TR>
                </THead>
                <TBody>
                  {installments.map((installment) => {
                    const remaining = remainingCents(installment);
                    const late = installment.status === "OVERDUE" ? daysOverdue(installment.dueDate, now) : 0;
                    return (
                      <TR key={installment.id}>
                        <TD>{installment.sequence}</TD>
                        <TD>
                          {formatDate(installment.dueDate)}
                          {late ? <span className="ml-2 text-xs text-destructive">{late} days late</span> : null}
                        </TD>
                        <TD>
                          <Badge tone={installment.status === "PAID" ? "success" : installment.status === "OVERDUE" ? "danger" : installment.status === "UPCOMING" ? "neutral" : "warning"}>
                            {installment.status}
                          </Badge>
                        </TD>
                        <TD align="right">{formatMoney(installment.amount, currency)}</TD>
                        <TD align="right">{formatMoney(installment.paidAmount, currency)}</TD>
                        <TD align="right">{formatMoney(fromCents(remaining), currency)}</TD>
                        {canRecord ? (
                          <TD align="right" className="print:hidden">
                            {remaining > 0 && sale.status !== "CANCELLED" ? (
                              <RecordPaymentDialog
                                installmentId={installment.id}
                                saleReference={sale.reference}
                                sequence={installment.sequence}
                                remaining={fromCents(remaining)}
                                currency={currency}
                              />
                            ) : null}
                          </TD>
                        ) : null}
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableShell>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Payments received</CardTitle></CardHeader>
        <CardContent>
          {sale.payments.length === 0 ? (
            <EmptyState title="No payments yet" />
          ) : (
            <TableShell>
              <Table>
                <THead>
                  <TR><TH>Date</TH><TH>Installment</TH><TH>Method</TH><TH>Reference</TH><TH>Received by</TH><TH align="right">Amount</TH></TR>
                </THead>
                <TBody>
                  {sale.payments.map((payment) => (
                    <TR key={payment.id}>
                      <TD>{formatDate(payment.paidAt)}</TD>
                      <TD>{payment.installment ? `#${payment.installment.sequence}` : "-"}</TD>
                      <TD>{titleCase(payment.method)}</TD>
                      <TD>{payment.reference ?? "-"}</TD>
                      <TD>{payment.receivedBy?.name ?? "-"}</TD>
                      <TD align="right">{formatMoney(payment.amount, payment.currency)}</TD>
                    </TR>
                  ))}
                  <TR>
                    <TD colSpan={5} className="font-semibold">Total paid</TD>
                    <TD align="right" className="font-semibold">{formatMoney(fromCents(paidCents), currency)}</TD>
                  </TR>
                </TBody>
              </Table>
            </TableShell>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
