import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Banknote, CalendarClock, CheckCircle2, Receipt } from "lucide-react";
import { Badge, EmptyState, PageHeader, StatCard, Table, TableShell, TBody, TD, TH, THead, TR } from "@/components/ui/data-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganization } from "@/lib/context";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { formatDate, formatMoney, formatNumber, titleCase } from "@/lib/format";
import { AGING_BUCKETS, agingReport, daysOverdue, fromCents, remainingCents, startOfDay, syncInstallmentStatuses } from "@/lib/collections";
import { cn } from "@/lib/utils";
import type { InstallmentStatus } from "@/generated/prisma/enums";
import { RecordPaymentDialog } from "../record-payment-dialog";

export const metadata = { title: "Finance & Installments" };

const FILTERS = [
  { key: "open", label: "Open", statuses: ["OVERDUE", "DUE", "PARTIALLY_PAID", "UPCOMING"] },
  { key: "overdue", label: "Overdue", statuses: ["OVERDUE"] },
  { key: "due", label: "Due now", statuses: ["DUE", "PARTIALLY_PAID"] },
  { key: "upcoming", label: "Upcoming", statuses: ["UPCOMING"] },
  { key: "paid", label: "Paid", statuses: ["PAID"] },
  { key: "all", label: "All", statuses: [] },
] as const satisfies readonly { key: string; label: string; statuses: InstallmentStatus[] }[];

const STATUS_ORDER: Record<InstallmentStatus, number> = { OVERDUE: 0, DUE: 1, PARTIALLY_PAID: 2, UPCOMING: 3, PAID: 4 };

function statusTone(status: InstallmentStatus) {
  if (status === "PAID") return "success" as const;
  if (status === "OVERDUE") return "danger" as const;
  if (status === "UPCOMING") return "neutral" as const;
  return "warning" as const;
}

export default async function InstallmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const context = await requireOrganization();
  if (!hasAnyPermission(context.permissions, ["payments.view", "collections.view"])) notFound();
  const canRecord = hasPermission(context.permissions, "payments.create");

  const params = await searchParams;
  const filter = FILTERS.find((entry) => entry.key === params.status) ?? FILTERS[0];

  const now = new Date();
  await syncInstallmentStatuses(context.db, now);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const next30 = new Date(startOfDay(now).getTime() + 31 * 86_400_000);

  const [installments, payments, overdueRows, dueCount, upcoming30, collectedThisMonth, collectedTotal] = await Promise.all([
    context.db.installment.findMany({
      where: filter.statuses.length ? { status: { in: [...filter.statuses] } } : undefined,
      orderBy: [{ dueDate: filter.key === "paid" ? "desc" : "asc" }],
      take: 200,
      include: { paymentPlan: { include: { sale: { include: { lead: { select: { id: true, firstName: true, lastName: true, phone: true } } } } } } },
    }),
    context.db.payment.findMany({
      orderBy: { paidAt: "desc" },
      take: 30,
      include: {
        sale: { select: { id: true, reference: true } },
        lead: { select: { firstName: true, lastName: true } },
        installment: { select: { sequence: true } },
        receivedBy: { select: { name: true } },
      },
    }),
    context.db.installment.findMany({
      where: { status: "OVERDUE" },
      select: { amount: true, paidAmount: true, dueDate: true },
    }),
    context.db.installment.count({ where: { status: { in: ["DUE", "PARTIALLY_PAID"] } } }),
    context.db.installment.findMany({
      where: { status: { not: "PAID" }, dueDate: { gte: startOfDay(now), lt: next30 } },
      select: { amount: true, paidAmount: true },
    }),
    context.db.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: monthStart } } }),
    context.db.payment.aggregate({ _sum: { amount: true } }),
  ]);

  const aging = agingReport(overdueRows, now);
  const upcomingCents = upcoming30.reduce((sum, row) => sum + remainingCents(row), 0);
  const rows = filter.key === "open"
    ? [...installments].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.dueDate.getTime() - b.dueDate.getTime())
    : installments;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance & Installments"
        description="Collect installments, track arrears and follow every customer's balance."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Overdue balance"
          value={formatMoney(fromCents(aging.totalCents), context.currency, { compact: true })}
          hint={`${formatNumber(overdueRows.length)} overdue installments`}
          icon={AlertTriangle}
        />
        <StatCard label="Due now" value={formatNumber(dueCount)} hint="Due today or partly paid" icon={CalendarClock} />
        <StatCard
          label="Due next 30 days"
          value={formatMoney(fromCents(upcomingCents), context.currency, { compact: true })}
          hint={`${formatNumber(upcoming30.length)} installments`}
          icon={Receipt}
        />
        <StatCard
          label="Collected this month"
          value={formatMoney(collectedThisMonth._sum.amount, context.currency, { compact: true })}
          hint={`${formatMoney(collectedTotal._sum.amount, context.currency, { compact: true })} all time`}
          icon={Banknote}
        />
      </div>

      <Card>
        <CardHeader><CardTitle>Arrears aging</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            {AGING_BUCKETS.map((bucket) => {
              const value = aging.buckets[bucket.key];
              return (
                <div key={bucket.key} className="rounded-md border border-border p-3">
                  <div className="text-xs text-muted-foreground">{bucket.label}</div>
                  <div className={cn("mt-1 text-lg font-semibold", value.count && bucket.min > 60 ? "text-destructive" : "text-foreground")}>
                    {formatMoney(value.amount, context.currency)}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatNumber(value.count)} installments</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Installment schedule</CardTitle>
          <nav className="flex flex-wrap gap-1">
            {FILTERS.map((entry) => (
              <Link
                key={entry.key}
                href={entry.key === "open" ? "/finance/installments" : `/finance/installments?status=${entry.key}`}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  entry.key === filter.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {entry.label}
              </Link>
            ))}
          </nav>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="Nothing here" description="No installments match this filter." />
          ) : (
            <TableShell>
              <Table>
                <THead>
                  <TR>
                    <TH>Customer</TH><TH>Sale</TH><TH>#</TH><TH>Due date</TH><TH>Status</TH>
                    <TH align="right">Amount</TH><TH align="right">Remaining</TH>{canRecord ? <TH /> : null}
                  </TR>
                </THead>
                <TBody>
                  {rows.map((installment) => {
                    const { sale } = installment.paymentPlan;
                    const remaining = remainingCents(installment);
                    const late = installment.status === "OVERDUE" ? daysOverdue(installment.dueDate, now) : 0;
                    return (
                      <TR key={installment.id}>
                        <TD>
                          <Link href={`/crm/leads/${sale.lead.id}`} className="font-medium hover:text-primary">
                            {sale.lead.firstName} {sale.lead.lastName}
                          </Link>
                          <div className="text-xs text-muted-foreground">{sale.lead.phone}</div>
                        </TD>
                        <TD>
                          <Link href={`/finance/sales/${sale.id}`} className="hover:text-primary">{sale.reference}</Link>
                        </TD>
                        <TD>{installment.sequence}</TD>
                        <TD>
                          {formatDate(installment.dueDate)}
                          {late ? <div className="text-xs text-destructive">{late} days late</div> : null}
                        </TD>
                        <TD><Badge tone={statusTone(installment.status)}>{installment.status}</Badge></TD>
                        <TD align="right">{formatMoney(installment.amount, installment.paymentPlan.currency)}</TD>
                        <TD align="right">{formatMoney(fromCents(remaining), installment.paymentPlan.currency)}</TD>
                        {canRecord ? (
                          <TD align="right">
                            {remaining > 0 && sale.status !== "CANCELLED" ? (
                              <RecordPaymentDialog
                                installmentId={installment.id}
                                saleReference={sale.reference}
                                sequence={installment.sequence}
                                remaining={fromCents(remaining)}
                                currency={installment.paymentPlan.currency}
                              />
                            ) : (
                              <CheckCircle2 className="ml-auto size-4 text-muted-foreground" />
                            )}
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
        <CardHeader><CardTitle>Recent payments</CardTitle></CardHeader>
        <CardContent>
          <TableShell>
            <Table>
              <THead>
                <TR><TH>Date</TH><TH>Customer</TH><TH>Sale</TH><TH>#</TH><TH>Method</TH><TH>Reference</TH><TH>Received by</TH><TH align="right">Amount</TH></TR>
              </THead>
              <TBody>
                {payments.map((payment) => (
                  <TR key={payment.id}>
                    <TD>{formatDate(payment.paidAt)}</TD>
                    <TD>{payment.lead ? `${payment.lead.firstName} ${payment.lead.lastName}` : "-"}</TD>
                    <TD className="font-medium">
                      <Link href={`/finance/sales/${payment.sale.id}`} className="hover:text-primary">{payment.sale.reference}</Link>
                    </TD>
                    <TD>{payment.installment?.sequence ?? "-"}</TD>
                    <TD>{titleCase(payment.method)}</TD>
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
