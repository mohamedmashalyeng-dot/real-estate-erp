import Link from "next/link";
import { notFound } from "next/navigation";
import { Banknote, Download, Receipt, Target, Users } from "lucide-react";
import { Badge, EmptyState, PageHeader, StatCard, Table, TableShell, TBody, TD, TH, THead, TR } from "@/components/ui/data-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { requireOrganization } from "@/lib/context";
import { hasPermission } from "@/lib/permissions";
import { formatDate, formatMoney, formatMonth, formatNumber, formatPercent, pluralize, titleCase } from "@/lib/format";
import { buildReport, formatDay, ratio, resolveRange, type ReportExport } from "@/lib/reports";

export const metadata = { title: "Reports" };

function presets(now: Date) {
  const today = formatDay(now);
  return [
    { label: "This month", from: formatDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: today },
    { label: "Last 3 months", from: formatDay(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: today },
    { label: "Last 6 months", from: formatDay(new Date(now.getFullYear(), now.getMonth() - 5, 1)), to: today },
    { label: "This year", from: formatDay(new Date(now.getFullYear(), 0, 1)), to: today },
  ];
}

function percent(value: number | null) {
  return value === null ? "—" : formatPercent(value);
}

function ExportLink({ kind, from, to }: { kind: ReportExport; from: string; to: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className="print:hidden">
      <a href={`/reports/export?type=${kind}&from=${from}&to=${to}`} download>
        <Download /> Excel
      </a>
    </Button>
  );
}

function Bar({ value, max, tone = "bg-primary" }: { value: number; max: number; tone?: string }) {
  const width = max > 0 ? Math.max(value > 0 ? 2 : 0, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-muted">
      <div className={`h-2 rounded-full ${tone}`} style={{ width: `${width}%` }} />
    </div>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const context = await requireOrganization();
  if (!hasPermission(context.permissions, "reports.view")) notFound();

  const now = new Date();
  const range = resolveRange(await searchParams, now);
  const report = await buildReport(context.db, range, now);
  const { fromDay, toDay } = range;
  const lastDay = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate() - 1);
  const currency = context.currency;

  const funnelMax = Math.max(...report.funnel.map((row) => row.count), 0);
  const collectionMax = Math.max(...report.collections.flatMap((row) => [Number(row.dueAmount), Number(row.collectedAmount)]), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description={`Sales, leads, marketing and collections from ${formatDate(range.from)} to ${formatDate(lastDay)}.`}
      />

      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          <form className="flex flex-wrap items-end gap-2" action="/reports">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              From
              <Input type="date" name="from" defaultValue={fromDay} className="w-40" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              To
              <Input type="date" name="to" defaultValue={toDay} className="w-40" />
            </label>
            <Button type="submit" size="sm">Apply</Button>
          </form>
          <div className="flex flex-wrap gap-1">
            {presets(now).map((preset) => (
              <Link
                key={preset.label}
                href={`/reports?from=${preset.from}&to=${preset.to}`}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  preset.from === fromDay && preset.to === toDay
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {preset.label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="New leads"
          value={formatNumber(report.totals.leads)}
          hint={`${formatNumber(report.totals.won)} won · ${percent(ratio(report.totals.won, report.totals.leads))} conversion`}
          icon={Users}
        />
        <StatCard
          label="Closed sales"
          value={formatMoney(report.totals.salesValue, currency, { compact: true })}
          hint={`${formatNumber(report.totals.salesCount)} ${pluralize(report.totals.salesCount, "contract")}`}
          icon={Receipt}
        />
        <StatCard
          label="Collected"
          value={formatMoney(report.totals.collected, currency, { compact: true })}
          hint={`of ${formatMoney(report.totals.due, currency, { compact: true })} due in period`}
          icon={Banknote}
        />
        <StatCard
          label="Collection rate"
          value={percent(report.totals.collectionRatePercent)}
          hint="Paid share of installments already due"
          icon={Target}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Pipeline funnel</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {report.totals.leads === 0 ? (
              <EmptyState title="No leads in this period" />
            ) : (
              report.funnel.map((row) => (
                <div key={row.stage} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{titleCase(row.stage)}</span>
                  <Bar value={row.count} max={funnelMax} tone={row.stage === "LOST" ? "bg-destructive/70" : row.stage === "WON" ? "bg-success" : "bg-primary"} />
                  <span className="text-right tabular-nums">{formatNumber(row.count)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Lead sources</CardTitle>
            <ExportLink kind="sources" from={fromDay} to={toDay} />
          </CardHeader>
          <CardContent>
            {report.sources.length === 0 ? (
              <EmptyState title="No leads in this period" />
            ) : (
              <TableShell>
                <Table>
                  <THead>
                    <TR><TH>Source</TH><TH align="right">Leads</TH><TH align="right">Qualified</TH><TH align="right">Won</TH><TH align="right">Conv.</TH></TR>
                  </THead>
                  <TBody>
                    {report.sources.map((row) => (
                      <TR key={row.source}>
                        <TD className="font-medium">{titleCase(row.source)}</TD>
                        <TD align="right">{formatNumber(row.leads)}</TD>
                        <TD align="right">{formatNumber(row.qualified)}</TD>
                        <TD align="right">{formatNumber(row.won)}</TD>
                        <TD align="right">{percent(row.conversionPercent)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableShell>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Sales team performance</CardTitle>
          <ExportLink kind="salespeople" from={fromDay} to={toDay} />
        </CardHeader>
        <CardContent>
          {report.salespeople.length === 0 ? (
            <EmptyState title="No sales activity in this period" />
          ) : (
            <TableShell>
              <Table>
                <THead>
                  <TR>
                    <TH>Salesperson</TH><TH align="right">Leads assigned</TH><TH align="right">Sales</TH>
                    <TH align="right">Close rate</TH><TH align="right">Sales value</TH><TH align="right">Collected</TH>
                  </TR>
                </THead>
                <TBody>
                  {report.salespeople.map((row, index) => (
                    <TR key={row.salespersonId}>
                      <TD className="font-medium">
                        {row.name}
                        {index === 0 && Number(row.salesValue) > 0 ? <Badge tone="success" className="ml-2">Top</Badge> : null}
                      </TD>
                      <TD align="right">{formatNumber(row.leadsAssigned)}</TD>
                      <TD align="right">{formatNumber(row.salesCount)}</TD>
                      <TD align="right">{percent(ratio(row.salesCount, row.leadsAssigned))}</TD>
                      <TD align="right">{formatMoney(row.salesValue, currency)}</TD>
                      <TD align="right">{formatMoney(row.collected, currency)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableShell>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Campaign return</CardTitle>
          <ExportLink kind="campaigns" from={fromDay} to={toDay} />
        </CardHeader>
        <CardContent>
          {report.campaigns.length === 0 ? (
            <EmptyState title="No campaigns ran in this period" />
          ) : (
            <TableShell>
              <Table>
                <THead>
                  <TR>
                    <TH>Campaign</TH><TH>Platform</TH><TH align="right">Cost</TH><TH align="right">Leads</TH><TH align="right">Won</TH>
                    <TH align="right">Cost / lead</TH><TH align="right">Cost / sale</TH><TH align="right">Sales value</TH><TH align="right">ROI</TH>
                  </TR>
                </THead>
                <TBody>
                  {report.campaigns.map((row) => (
                    <TR key={row.id}>
                      <TD className="font-medium">{row.name}</TD>
                      <TD>{titleCase(row.platform)}</TD>
                      <TD align="right">{formatMoney(row.cost, row.currency)}</TD>
                      <TD align="right">{formatNumber(row.leads)}</TD>
                      <TD align="right">{formatNumber(row.won)}</TD>
                      <TD align="right">{row.costPerLead ? formatMoney(row.costPerLead, row.currency) : "—"}</TD>
                      <TD align="right">{row.costPerSale ? formatMoney(row.costPerSale, row.currency) : "—"}</TD>
                      <TD align="right">{formatMoney(row.salesValue, currency)}</TD>
                      <TD align="right">
                        {row.roiMultiple === null ? "—" : (
                          <Badge tone={row.roiMultiple >= 1 ? "success" : "danger"}>{row.roiMultiple.toFixed(1)}x</Badge>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableShell>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Leads and won counts cover each campaign&apos;s whole life; sales value counts contracts closed in the selected period.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Collections by month</CardTitle>
          <ExportLink kind="collections" from={fromDay} to={toDay} />
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-muted-foreground/40" /> Due</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" /> Collected</span>
          </div>
          <TableShell>
            <Table>
              <THead>
                <TR><TH>Month</TH><TH className="w-1/3" /><TH align="right">Due</TH><TH align="right">Collected</TH><TH align="right">Rate</TH></TR>
              </THead>
              <TBody>
                {report.collections.map((row) => (
                  <TR key={row.month}>
                    <TD className="font-medium whitespace-nowrap">{formatMonth(row.month)}</TD>
                    <TD>
                      <div className="space-y-1">
                        <Bar value={Number(row.dueAmount)} max={collectionMax} tone="bg-muted-foreground/40" />
                        <Bar value={Number(row.collectedAmount)} max={collectionMax} />
                      </div>
                    </TD>
                    <TD align="right">{formatMoney(row.dueAmount, currency)}</TD>
                    <TD align="right">{formatMoney(row.collectedAmount, currency)}</TD>
                    <TD align="right">
                      {row.ratePercent === null ? "—" : (
                        <Badge tone={row.ratePercent >= 90 ? "success" : row.ratePercent >= 60 ? "warning" : "danger"}>
                          {formatPercent(row.ratePercent)}
                        </Badge>
                      )}
                    </TD>
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
