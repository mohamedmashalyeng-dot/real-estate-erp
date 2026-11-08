import { notFound } from "next/navigation";
import { BarChart3, Megaphone, MousePointerClick, Users } from "lucide-react";
import { Badge, PageHeader, StatCard, Table, TableShell, TBody, TD, TH, THead, TR } from "@/components/ui/data-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganization } from "@/lib/context";
import { hasPermission } from "@/lib/permissions";
import { formatDate, formatMoney, formatNumber, titleCase } from "@/lib/format";

export const metadata = { title: "Marketing Campaigns" };

export default async function CampaignsPage() {
  const context = await requireOrganization();
  if (!hasPermission(context.permissions, "marketing.view")) notFound();

  const [campaigns, totalCampaigns, activeCampaigns, leadsFromCampaigns, spend] = await Promise.all([
    context.db.campaign.findMany({
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      take: 100,
      include: { _count: { select: { leads: true } } },
    }),
    context.db.campaign.count(),
    context.db.campaign.count({ where: { status: "ACTIVE" } }),
    context.db.lead.count({ where: { campaignId: { not: null } } }),
    context.db.campaign.aggregate({ _sum: { cost: true } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing Campaigns"
        description="Campaign spend, generated leads, source mix, and active acquisition programs."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Campaigns" value={formatNumber(totalCampaigns)} icon={Megaphone} />
        <StatCard label="Active" value={formatNumber(activeCampaigns)} icon={MousePointerClick} />
        <StatCard label="Attributed Leads" value={formatNumber(leadsFromCampaigns)} icon={Users} />
        <StatCard label="Spend" value={formatMoney(spend._sum.cost, context.currency, { compact: true })} icon={BarChart3} />
      </div>

      <Card>
        <CardHeader><CardTitle>Campaign Performance</CardTitle></CardHeader>
        <CardContent>
          <TableShell>
            <Table>
              <THead>
                <TR><TH>Name</TH><TH>Platform</TH><TH>Status</TH><TH>Start</TH><TH>End</TH><TH align="right">Leads</TH><TH align="right">Cost</TH></TR>
              </THead>
              <TBody>
                {campaigns.map((campaign) => (
                  <TR key={campaign.id}>
                    <TD className="font-medium">{campaign.name}</TD>
                    <TD>{titleCase(campaign.platform)}</TD>
                    <TD><Badge tone={campaign.status === "ACTIVE" ? "success" : campaign.status === "PAUSED" ? "warning" : "neutral"}>{campaign.status}</Badge></TD>
                    <TD>{formatDate(campaign.startDate)}</TD>
                    <TD>{formatDate(campaign.endDate)}</TD>
                    <TD align="right">{campaign._count.leads}</TD>
                    <TD align="right">{formatMoney(campaign.cost, campaign.currency)}</TD>
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
