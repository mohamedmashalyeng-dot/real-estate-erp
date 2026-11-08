import { PageHeader } from "@/components/ui/data-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DefinitionList } from "@/components/ui/data-display";
import { formatDate, formatMoney, titleCase } from "@/lib/format";
import { LeadStageSelector } from "./stage-selector";
import { LeadAssignForm } from "./assign-form";

interface LeadHeaderProps {
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    stage: string;
    createdAt: Date;
    createdBy: { name: string } | null;
    assignedToId: string | null;
  };
  canUpdate: boolean;
}

export function LeadHeader({ lead, canUpdate }: LeadHeaderProps) {
  return (
    <>
      <PageHeader
        title={`${lead.firstName} ${lead.lastName}`}
        breadcrumbs={[{ label: "CRM & Leads", href: "/crm/leads" }, { label: `${lead.firstName} ${lead.lastName}` }]}
        description={`Lead profile · created ${formatDate(lead.createdAt)}${
          lead.createdBy ? ` by ${lead.createdBy.name}` : ""
        }`}
        actions={
          <div className="flex items-center gap-3">
            <LeadStageSelector leadId={lead.id} currentStage={lead.stage} canUpdate={canUpdate} />
          </div>
        }
      />
    </>
  );
}

export function LeadAssignmentCard({
  leadId,
  assignedToId,
  agents,
}: {
  leadId: string;
  assignedToId: string | null;
  agents: { id: string; name: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Assignment</CardTitle>
      </CardHeader>
      <CardContent>
        <LeadAssignForm leadId={leadId} agents={agents} currentAssigneeId={assignedToId} canAssign />
      </CardContent>
    </Card>
  );
}

export function LeadProfileCard({
  lead,
}: {
  lead: {
    phone: string;
    email: string | null;
    city: string | null;
    country: string | null;
    budgetMin: { toString(): string } | null;
    budgetMax: { toString(): string } | null;
    currency: string;
    propertyType: string | null;
    bedrooms: number | null;
    preferredLocation: string | null;
    notes: string | null;
    preferredProject: { name: string } | null;
    campaign: { name: string; platform: string } | null;
    assignedTo: { name: string } | null;
  };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact & Requirements</CardTitle>
      </CardHeader>
      <CardContent>
        <DefinitionList
          items={[
            { label: "Phone", value: lead.phone },
            { label: "Email", value: lead.email ?? "—" },
            {
              label: "Location",
              value: [lead.city, lead.country].filter(Boolean).join(", ") || "—",
            },
            { label: "Assignee", value: lead.assignedTo?.name ?? "Unassigned" },
            {
              label: "Budget",
              value:
                lead.budgetMin || lead.budgetMax
                  ? `${lead.budgetMin ? formatMoney(lead.budgetMin.toString(), lead.currency) : "—"} → ${
                      lead.budgetMax ? formatMoney(lead.budgetMax.toString(), lead.currency) : "—"
                    }`
                  : "—",
            },
            {
              label: "Preference",
              value: `${lead.propertyType ? titleCase(lead.propertyType) : "Any type"}${lead.bedrooms ? ` · ${lead.bedrooms} BR` : ""}${
                lead.preferredLocation ? ` · ${lead.preferredLocation}` : ""
              }`,
            },
            { label: "Project", value: lead.preferredProject?.name ?? "—" },
            {
              label: "Campaign",
              value: lead.campaign ? `${lead.campaign.name} (${titleCase(lead.campaign.platform)})` : "—",
            },
            {
              label: "Notes",
              value: lead.notes ? <span className="block whitespace-pre-wrap">{lead.notes}</span> : "—",
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}
