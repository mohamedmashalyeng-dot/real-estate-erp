import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Brain, CalendarClock, Sparkles } from "lucide-react";
import { Badge, PageHeader, StatCard, Table, TableShell, TBody, TD, TH, THead, TR } from "@/components/ui/data-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganization } from "@/lib/context";
import { hasPermission } from "@/lib/permissions";
import { formatDateTime, formatMoney, formatNumber, formatRelative } from "@/lib/format";

export const metadata = { title: "EstateIQ AI" };

export default async function AssistantPage() {
  const context = await requireOrganization();
  if (!hasPermission(context.permissions, "ai.use")) notFound();

  const now = new Date();
  const [overdueFollowUps, hotLeads, staleDeals, collectionRisk, insights, conversations] = await Promise.all([
    context.db.followUp.findMany({
      where: { status: "PENDING", dueAt: { lt: now } },
      orderBy: { dueAt: "asc" },
      take: 20,
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, phone: true, temperature: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    context.db.lead.findMany({
      where: { temperature: "HOT", stage: { notIn: ["WON", "LOST"] } },
      orderBy: [{ priorityScore: "desc" }, { updatedAt: "desc" }],
      take: 20,
      include: { assignedTo: { select: { name: true } } },
    }),
    context.db.sale.findMany({
      where: { status: "PENDING_APPROVAL" },
      orderBy: { updatedAt: "asc" },
      take: 20,
      include: { lead: { select: { firstName: true, lastName: true } }, unit: { select: { unitCode: true } } },
    }),
    context.db.installment.aggregate({
      _sum: { amount: true },
      where: { status: { in: ["DUE", "OVERDUE", "PARTIALLY_PAID"] } },
    }),
    context.db.aIInsight.findMany({
      where: { dismissedAt: null },
      orderBy: [{ severity: "desc" }, { generatedAt: "desc" }],
      take: 20,
    }),
    context.db.aIConversation.count(),
  ]);

  const generatedSignals = [
    {
      title: "Overdue follow-ups need action",
      severity: overdueFollowUps.length > 0 ? "CRITICAL" : "POSITIVE",
      summary:
        overdueFollowUps.length > 0
          ? `${overdueFollowUps.length} pending follow-ups are past due. Start with the oldest assigned items.`
          : "No overdue follow-ups right now.",
    },
    {
      title: "Hot leads ready for conversion",
      severity: hotLeads.length > 0 ? "INFO" : "WARNING",
      summary:
        hotLeads.length > 0
          ? `${hotLeads.length} hot open leads should stay under daily contact cadence.`
          : "No hot open leads are currently visible.",
    },
    {
      title: "Approval queue",
      severity: staleDeals.length > 0 ? "WARNING" : "POSITIVE",
      summary:
        staleDeals.length > 0
          ? `${staleDeals.length} sales are waiting for approval.`
          : "No sales are waiting for approval.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="EstateIQ AI"
        description="Operational intelligence from live CRM, sales, inventory, and collections data."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="AI Conversations" value={formatNumber(conversations)} icon={Sparkles} />
        <StatCard label="Overdue Follow-ups" value={formatNumber(overdueFollowUps.length)} icon={CalendarClock} />
        <StatCard label="Hot Open Leads" value={formatNumber(hotLeads.length)} icon={Brain} />
        <StatCard label="Collection Risk" value={formatMoney(collectionRisk._sum.amount, context.currency, { compact: true })} icon={AlertTriangle} />
      </div>

      <Card>
        <CardHeader><CardTitle>Generated Signals</CardTitle></CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-3">
          {generatedSignals.map((signal) => (
            <div key={signal.title} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{signal.title}</p>
                <Badge tone={signal.severity === "CRITICAL" ? "danger" : signal.severity === "WARNING" ? "warning" : signal.severity === "POSITIVE" ? "success" : "info"}>
                  {signal.severity}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{signal.summary}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Overdue Follow-ups</CardTitle></CardHeader>
        <CardContent>
          {overdueFollowUps.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No overdue follow-ups.</p>
          ) : (
            <TableShell>
              <Table>
                <THead><TR><TH>Lead</TH><TH>Type</TH><TH>Due</TH><TH>Assignee</TH><TH>Temperature</TH></TR></THead>
                <TBody>
                  {overdueFollowUps.map((followUp) => (
                    <TR key={followUp.id}>
                      <TD>
                        <Link href={`/crm/leads/${followUp.lead.id}`} className="font-medium hover:text-primary">
                          {followUp.lead.firstName} {followUp.lead.lastName}
                        </Link>
                      </TD>
                      <TD>{followUp.type}</TD>
                      <TD>{formatDateTime(followUp.dueAt)} ({formatRelative(followUp.dueAt)})</TD>
                      <TD>{followUp.assignedTo.name}</TD>
                      <TD><Badge tone={followUp.lead.temperature === "HOT" ? "danger" : "warning"}>{followUp.lead.temperature}</Badge></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableShell>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Saved AI Insights</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {insights.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No saved insights yet.</p>
          ) : (
            insights.map((insight) => (
              <div key={insight.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                  <Badge tone={insight.severity === "CRITICAL" ? "danger" : insight.severity === "WARNING" ? "warning" : insight.severity === "POSITIVE" ? "success" : "info"}>
                    {insight.severity}
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{insight.summary}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
