import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building,
  CalendarClock,
  Calculator,
  KeyRound,
  Phone,
  Plus,
  Receipt,
  Users,
} from "lucide-react";
import { requireOrganization } from "@/lib/context";
import { hasPermission } from "@/lib/permissions";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/data-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney, formatNumber, formatRelative, titleCase } from "@/lib/format";
import { fromCents, remainingCents, startOfDay, syncInstallmentStatuses } from "@/lib/collections";
import { cn } from "@/lib/utils";
import type { LeadStage, UnitStatus } from "@/generated/prisma/enums";

export const metadata = {
  title: "Dashboard",
};

const PIPELINE: { stage: LeadStage; color: string }[] = [
  { stage: "NEW", color: "bg-chart-2" },
  { stage: "CONTACTED", color: "bg-chart-2" },
  { stage: "QUALIFIED", color: "bg-primary" },
  { stage: "VIEWING", color: "bg-primary" },
  { stage: "NEGOTIATION", color: "bg-primary" },
  { stage: "RESERVATION", color: "bg-chart-4" },
  { stage: "WON", color: "bg-success" },
];

const UNIT_STATUSES: { status: UnitStatus; label: string; color: string }[] = [
  { status: "AVAILABLE", label: "Available", color: "bg-success" },
  { status: "RESERVED", label: "Reserved", color: "bg-warning" },
  { status: "SOLD", label: "Sold", color: "bg-primary" },
  { status: "BLOCKED", label: "Blocked", color: "bg-muted-foreground/50" },
  { status: "UNAVAILABLE", label: "Unavailable", color: "bg-muted-foreground/30" },
];

function greeting(now: Date) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
      {children} <ArrowRight className="size-3.5" />
    </Link>
  );
}

export default async function DashboardPage() {
  const context = await requireOrganization();
  const { db, currency, membership, user, permissions } = context;
  const canLeads = hasPermission(permissions, "leads.view");
  const canFinance = hasPermission(permissions, "payments.view") || hasPermission(permissions, "collections.view");

  const now = new Date();
  const endOfToday = new Date(startOfDay(now).getTime() + 86_400_000);
  const in14Days = new Date(startOfDay(now).getTime() + 15 * 86_400_000);
  if (canFinance) await syncInstallmentStatuses(db, now);

  const [stageGroups, totalLeads, unitGroups, sales, activeReservations, followUps, recentLeads, overdue, upcoming] =
    await Promise.all([
      db.lead.groupBy({ by: ["stage"], _count: { _all: true } }),
      db.lead.count(),
      db.unit.groupBy({ by: ["status"], _count: { _all: true } }),
      db.sale.aggregate({
        _sum: { contractValue: true },
        _count: { _all: true },
        where: { status: { in: ["APPROVED", "CONTRACTED", "COMPLETED"] } },
      }),
      db.reservation.count({ where: { status: "ACTIVE" } }),
      canLeads
        ? db.followUp.findMany({
            where: { status: "PENDING", dueAt: { lt: endOfToday } },
            orderBy: { dueAt: "asc" },
            take: 6,
            include: {
              lead: { select: { id: true, firstName: true, lastName: true, phone: true } },
              assignedTo: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      canLeads
        ? db.lead.findMany({
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { id: true, firstName: true, lastName: true, stage: true, source: true, createdAt: true, temperature: true },
          })
        : Promise.resolve([]),
      canFinance
        ? db.installment.findMany({ where: { status: "OVERDUE" }, select: { amount: true, paidAmount: true } })
        : Promise.resolve([]),
      canFinance
        ? db.installment.findMany({
            where: { status: { not: "PAID" }, dueDate: { gte: startOfDay(now), lt: in14Days } },
            orderBy: { dueDate: "asc" },
            take: 5,
            include: {
              paymentPlan: {
                select: { currency: true, sale: { select: { id: true, reference: true, lead: { select: { firstName: true, lastName: true } } } } },
              },
            },
          })
        : Promise.resolve([]),
    ]);

  const stageCounts = new Map(stageGroups.map((row) => [row.stage, row._count._all]));
  const openLeads = PIPELINE.filter((row) => row.stage !== "WON").reduce((sum, row) => sum + (stageCounts.get(row.stage) ?? 0), 0);
  const pipelineMax = Math.max(1, ...PIPELINE.map((row) => stageCounts.get(row.stage) ?? 0));

  const unitCounts = new Map(unitGroups.map((row) => [row.status, row._count._all]));
  const totalUnits = unitGroups.reduce((sum, row) => sum + row._count._all, 0);
  const availableUnits = unitCounts.get("AVAILABLE") ?? 0;

  const overdueCents = overdue.reduce((sum, row) => sum + remainingCents(row), 0);
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`${greeting(now)}, ${firstName}`}
        description={`Here's what's happening at ${membership.organizationName} today · ${formatDate(now)}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/sales/calculator"><Calculator /> Payment calculator</Link>
            </Button>
            {hasPermission(permissions, "leads.create") ? (
              <Button asChild size="sm">
                <Link href="/crm/leads/new"><Plus /> New lead</Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Active leads"
          value={formatNumber(openLeads)}
          hint={`${formatNumber(totalLeads)} lifetime · ${formatNumber(stageCounts.get("WON") ?? 0)} won`}
          icon={Users}
          href={canLeads ? "/crm/leads" : undefined}
        />
        <StatCard
          label="Available units"
          value={formatNumber(availableUnits)}
          hint={`of ${formatNumber(totalUnits)} units · ${formatNumber(activeReservations)} reserved`}
          icon={Building}
          tone="info"
          href="/inventory/projects"
        />
        <StatCard
          label="Contracted sales"
          value={formatMoney(sales._sum.contractValue, currency, { compact: true })}
          hint={`${formatNumber(sales._count._all)} ${sales._count._all === 1 ? "contract" : "contracts"}`}
          icon={Receipt}
          tone="success"
          href="/sales"
        />
        <StatCard
          label="Overdue collections"
          value={formatMoney(fromCents(overdueCents), currency, { compact: true })}
          hint={overdue.length ? `${formatNumber(overdue.length)} installments late` : "Nothing overdue"}
          icon={AlertTriangle}
          tone={overdue.length ? "danger" : "neutral"}
          href={canFinance ? "/finance/installments?status=overdue" : undefined}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Sales pipeline</CardTitle>
            {canLeads ? <SectionLink href="/crm/leads">All leads</SectionLink> : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {PIPELINE.map((row) => {
              const count = stageCounts.get(row.stage) ?? 0;
              return (
                <Link
                  key={row.stage}
                  href={`/crm/leads?stage=${row.stage}`}
                  className="group grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-sm"
                >
                  <span className="text-muted-foreground group-hover:text-foreground">{titleCase(row.stage)}</span>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all", row.color)}
                      style={{ width: `${count ? Math.max(4, (count / pipelineMax) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-right font-medium tabular-nums">{formatNumber(count)}</span>
                </Link>
              );
            })}
            <p className="pt-1 text-xs text-muted-foreground">
              {formatNumber(stageCounts.get("LOST") ?? 0)} lost leads not shown.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Inventory</CardTitle>
            <SectionLink href="/inventory/projects">Units</SectionLink>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums">{formatNumber(totalUnits)}</span>
                <span className="text-sm text-muted-foreground">units in portfolio</span>
              </div>
              <div className="mt-3 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
                {UNIT_STATUSES.map((entry) => {
                  const count = unitCounts.get(entry.status) ?? 0;
                  return count ? (
                    <div
                      key={entry.status}
                      className={entry.color}
                      style={{ width: `${(count / Math.max(1, totalUnits)) * 100}%` }}
                      title={`${entry.label}: ${count}`}
                    />
                  ) : null;
                })}
              </div>
            </div>
            <ul className="space-y-2.5 text-sm">
              {UNIT_STATUSES.filter((entry) => unitCounts.get(entry.status) || entry.status === "AVAILABLE").map((entry) => {
                const count = unitCounts.get(entry.status) ?? 0;
                return (
                  <li key={entry.status} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className={cn("size-2.5 rounded-sm", entry.color)} />
                      {entry.label}
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatNumber(count)}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        {totalUnits ? Math.round((count / totalUnits) * 100) : 0}%
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {canLeads ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Follow-ups due &amp; overdue</CardTitle>
              <Badge tone={followUps.some((item) => item.dueAt < startOfDay(now)) ? "danger" : "primary"}>
                {formatNumber(followUps.length)}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {followUps.length === 0 ? (
                <EmptyState icon={CalendarClock} title="You're all caught up" description="No follow-ups due today." />
              ) : (
                <ul className="divide-y divide-border">
                  {followUps.map((item) => {
                    const late = item.dueAt < startOfDay(now);
                    return (
                      <li key={item.id}>
                        <Link href={`/crm/leads/${item.lead.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40">
                          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", late ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
                            <Phone className="size-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.lead.firstName} {item.lead.lastName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {titleCase(item.type)} · {item.assignedTo.name}
                            </p>
                          </div>
                          <span className={cn("shrink-0 text-xs", late ? "font-medium text-destructive" : "text-muted-foreground")}>
                            {formatRelative(item.dueAt)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}

        {canFinance ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Installments due soon</CardTitle>
              <SectionLink href="/finance/installments">Finance</SectionLink>
            </CardHeader>
            <CardContent className="p-0">
              {upcoming.length === 0 ? (
                <EmptyState icon={KeyRound} title="Nothing due in the next 2 weeks" />
              ) : (
                <ul className="divide-y divide-border">
                  {upcoming.map((item) => {
                    const sale = item.paymentPlan.sale;
                    return (
                      <li key={item.id}>
                        <Link href={`/finance/sales/${sale.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40">
                          <div className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-border py-1 leading-none">
                            <span className="text-[10px] font-medium uppercase text-muted-foreground">
                              {item.dueDate.toLocaleString("en-US", { month: "short" })}
                            </span>
                            <span className="mt-0.5 text-sm font-semibold">{item.dueDate.getDate()}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{sale.lead.firstName} {sale.lead.lastName}</p>
                            <p className="truncate text-xs text-muted-foreground">{sale.reference} · #{item.sequence}</p>
                          </div>
                          <span className="shrink-0 text-sm font-medium tabular-nums">
                            {formatMoney(fromCents(remainingCents(item)), item.paymentPlan.currency, { compact: true })}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}

        {canLeads ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Newest leads</CardTitle>
              <SectionLink href="/crm/leads">View all</SectionLink>
            </CardHeader>
            <CardContent className="p-0">
              {recentLeads.length === 0 ? (
                <EmptyState icon={Users} title="No leads yet" />
              ) : (
                <ul className="divide-y divide-border">
                  {recentLeads.map((lead) => (
                    <li key={lead.id}>
                      <Link href={`/crm/leads/${lead.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                          {`${lead.firstName[0] ?? ""}${lead.lastName[0] ?? ""}`.toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{lead.firstName} {lead.lastName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {titleCase(lead.source)} · {formatRelative(lead.createdAt)}
                          </p>
                        </div>
                        <Badge tone={lead.stage === "WON" ? "success" : lead.stage === "LOST" ? "danger" : "primary"}>
                          {lead.stage}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
