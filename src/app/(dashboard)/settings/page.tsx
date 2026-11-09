import { notFound } from "next/navigation";
import { Building2, Clock, CreditCard, Settings } from "lucide-react";
import { Badge, DefinitionList, PageHeader, StatCard } from "@/components/ui/data-display";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganization } from "@/lib/context";
import { hasPermission } from "@/lib/permissions";
import { formatDate, formatDateTime, formatNumber, titleCase } from "@/lib/format";
import { savePricingSheetUrlAction, saveLeadsSheetUrlAction } from "./actions";
import { SheetLinkForm } from "./sheet-link-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const context = await requireOrganization();
  if (!hasPermission(context.permissions, "settings.manage")) notFound();

  const [settings, subscription, usage] = await Promise.all([
    context.db.organizationSettings.findUnique({ where: { organizationId: context.organizationId } }),
    context.db.subscription.findUnique({ where: { organizationId: context.organizationId } }),
    context.db.usageRecord.findMany({ orderBy: { periodStart: "desc" }, take: 12 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Organization defaults, SaaS plan status, operational SLA rules, and usage telemetry."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Organization" value={context.membership.organizationName} icon={Building2} />
        <StatCard label="Currency" value={context.currency} icon={CreditCard} />
        <StatCard label="Lead SLA" value={`${settings?.leadSlaHours ?? 24}h`} icon={Clock} />
        <StatCard label="AI Budget" value={formatNumber(settings?.aiMonthlyTokenBudget ?? 0)} icon={Settings} />
      </div>

      <Card>
        <CardHeader><CardTitle>Organization Defaults</CardTitle></CardHeader>
        <CardContent>
          <DefinitionList
            items={[
              { label: "Name", value: context.membership.organizationName },
              { label: "Slug", value: context.membership.organizationSlug },
              { label: "Status", value: <Badge tone="success">{context.membership.organizationStatus}</Badge> },
              { label: "Default Follow-up", value: titleCase(settings?.defaultFollowUpType ?? "CALL") },
              { label: "Auto Follow-up", value: settings?.autoCreateFollowUpOnNewLead ? "Enabled" : "Disabled" },
              { label: "Token Budget", value: formatNumber(settings?.aiMonthlyTokenBudget ?? 0) },
            ]}
          />
        </CardContent>
      </Card>

      <Card id="google-sheet">
        <CardHeader>
          <CardTitle>Google Sheet Leads</CardTitle>
          <CardDescription>
            Import the sales team&apos;s lead tracker into CRM. Use &quot;Sync Google Sheet&quot; on the Leads page to pull new and edited rows.
            {settings?.leadsSheetUrl ? ` Last synced: ${formatDateTime(settings.leadsSheetSyncedAt)}.` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SheetLinkForm
            id="leads-sheet-url"
            label="Google Sheet link"
            hint='The sheet must be shared as "Anyone with the link" (Viewer). Every tab with "New lead" and "Phone" columns is imported; other tabs are ignored.'
            currentUrl={settings?.leadsSheetUrl ?? null}
            action={saveLeadsSheetUrlAction}
          />
        </CardContent>
      </Card>

      <Card id="pricing-sheet">
        <CardHeader>
          <CardTitle>Payment Calculator Sheet</CardTitle>
          <CardDescription>
            Unit prices (price per m² by area, add-ons) and default plan terms for the Payment Calculator are read from this sheet. Refresh them from the calculator page whenever the sheet changes.
            {settings?.pricingSheetUrl ? ` Last read: ${formatDateTime(settings.pricingSheetSyncedAt)}.` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SheetLinkForm
            id="pricing-sheet-url"
            label="Calculator sheet link"
            hint='Shared as "Anyone with the link" (Viewer), with the "Sales Payment Calculator" layout: Unit area, Price per m², Contract payment, Down payment, Annual payment rate...'
            currentUrl={settings?.pricingSheetUrl ?? null}
            action={savePricingSheetUrlAction}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
        <CardContent>
          <DefinitionList
            items={[
              { label: "Plan", value: titleCase(subscription?.plan ?? "STARTER") },
              { label: "Status", value: subscription ? <Badge tone="primary">{subscription.status}</Badge> : "Not configured" },
              { label: "Seats", value: subscription?.seats ?? "—" },
              { label: "Period Start", value: formatDate(subscription?.currentPeriodStart) },
              { label: "Period End", value: formatDate(subscription?.currentPeriodEnd) },
              { label: "Cancel at period end", value: subscription?.cancelAtPeriodEnd ? "Yes" : "No" },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Usage Records</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs">
          {usage.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">No usage records yet.</p>
          ) : (
            usage.map((record) => (
              <div key={record.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="font-medium text-foreground">{record.metric}</span>
                <span className="text-muted-foreground">{formatNumber(record.quantity)} between {formatDate(record.periodStart)} and {formatDate(record.periodEnd)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
