import Link from "next/link";
import { FileSpreadsheet, Plus } from "lucide-react";
import { requirePermission } from "@/lib/context";
import { hasPermission } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/data-display";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { LeadFilters } from "@/components/crm/lead-filters";
import { LeadTable } from "@/components/crm/lead-table";
import { Prisma } from "@/generated/prisma/client";
import type { LeadSource, LeadStage, LeadTemperature } from "@/generated/prisma/enums";
import { LEAD_SOURCE_VALUES, LEAD_STAGE_VALUES, LEAD_TEMPERATURE_VALUES } from "./new/schema";
import { SheetSyncButton } from "./sheet-sync-button";

export const metadata = {
  title: "CRM Leads",
};

interface SearchParams {
  search?: string;
  stage?: string;
  source?: string;
  temperature?: string;
  page?: string;
  pageSize?: string;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await requirePermission("leads.view");
  const params = await searchParams;

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const pageSize = Math.max(10, Number.parseInt(params.pageSize ?? "25", 10) || 25);
  const skip = (page - 1) * pageSize;

  const where: Prisma.LeadWhereInput = {};

  if (params.search) {
    const q = params.search.trim();
    // MySQL/MariaDB collations are case-insensitive, so `contains` already ignores case.
    where.OR = [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { phone: { contains: q } },
      { email: { contains: q } },
    ];
  }

  if (params.stage && params.stage !== "ALL") {
    if (LEAD_STAGE_VALUES.includes(params.stage as LeadStage)) {
      where.stage = params.stage as LeadStage;
    }
  }

  if (params.source && params.source !== "ALL") {
    if (LEAD_SOURCE_VALUES.includes(params.source as LeadSource)) {
      where.source = params.source as LeadSource;
    }
  }

  if (params.temperature && params.temperature !== "ALL") {
    if (LEAD_TEMPERATURE_VALUES.includes(params.temperature as LeadTemperature)) {
      where.temperature = params.temperature as LeadTemperature;
    }
  }

  const [totalCount, rows, settings] = await Promise.all([
    context.db.lead.count({ where }),
    context.db.lead.findMany({
      where,
      orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        stage: true,
        source: true,
        temperature: true,
        priorityScore: true,
        budgetMax: true,
        currency: true,
        createdAt: true,
        assignedTo: {
          select: { id: true, name: true },
        },
      },
    }),
    context.db.organizationSettings.findUnique({
      where: { organizationId: context.organizationId },
      select: { leadsSheetUrl: true, leadsSheetSyncedAt: true },
    }),
  ]);

  const canSyncSheet = hasPermission(context.permissions, "leads.create");
  const canConnectSheet = hasPermission(context.permissions, "settings.manage");

  const leads = rows.map((r) => ({
    ...r,
    budgetMax: r.budgetMax?.toString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM & Leads"
        description="Monitor lead generation pipeline, assign agents, and track conversion milestones."
        actions={
          <>
            {settings?.leadsSheetUrl && canSyncSheet ? (
              <SheetSyncButton
                lastSyncedLabel={settings.leadsSheetSyncedAt ? formatDateTime(settings.leadsSheetSyncedAt) : null}
              />
            ) : !settings?.leadsSheetUrl && canConnectSheet ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/settings#google-sheet">
                  <FileSpreadsheet className="size-4" />
                  <span>Connect Google Sheet</span>
                </Link>
              </Button>
            ) : null}
            <Button asChild size="sm">
              <Link href="/crm/leads/new">
                <Plus className="size-4" />
                <span>Create Lead</span>
              </Link>
            </Button>
          </>
        }
      />

      <LeadFilters />

      <LeadTable leads={leads} />

      <Pagination
        page={page}
        pageSize={pageSize}
        total={totalCount}
        basePath="/crm/leads"
        searchParams={params as Record<string, string | undefined>}
      />
    </div>
  );
}
