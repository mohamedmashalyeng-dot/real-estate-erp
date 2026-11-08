import Link from "next/link";
import { Badge } from "@/components/ui/data-display";
import { Table, TableShell, TBody, TD, TH, THead, TR, EmptyState } from "@/components/ui/data-display";
import { formatDate, formatMoney, titleCase } from "@/lib/format";
import { Users, Phone, Mail, Sparkles } from "lucide-react";

export interface LeadListItem {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  stage: string;
  source: string;
  temperature: string;
  priorityScore: number;
  budgetMax: string | null;
  currency: string;
  assignedTo: { id: string; name: string } | null;
  createdAt: Date;
}

function stageTone(stage: string) {
  switch (stage) {
    case "WON":
      return "success" as const;
    case "LOST":
      return "danger" as const;
    case "RESERVATION":
      return "primary" as const;
    case "VIEWING":
    case "NEGOTIATION":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

function tempTone(temp: string) {
  switch (temp) {
    case "HOT":
      return "danger" as const;
    case "WARM":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

export function LeadTable({ leads }: { leads: LeadListItem[] }) {
  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No leads found"
        description="Try clearing your search or filters to see more leads, or create a new lead."
      />
    );
  }

  return (
    <TableShell>
      <Table>
        <THead>
          <TR>
            <TH>Lead</TH>
            <TH>Stage</TH>
            <TH>Temperature</TH>
            <TH>Priority</TH>
            <TH>Budget</TH>
            <TH>Assigned Agent</TH>
            <TH>Source</TH>
            <TH>Created</TH>
          </TR>
        </THead>
        <TBody>
          {leads.map((lead) => (
            <TR key={lead.id}>
              <TD>
                <div className="flex flex-col">
                  <Link
                    href={`/crm/leads/${lead.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {lead.firstName} {lead.lastName}
                  </Link>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Phone className="size-3" /> {lead.phone}
                    </span>
                    {lead.email ? (
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" /> {lead.email}
                      </span>
                    ) : null}
                  </div>
                </div>
              </TD>
              <TD>
                <Badge tone={stageTone(lead.stage)}>{lead.stage}</Badge>
              </TD>
              <TD>
                <Badge tone={tempTone(lead.temperature)}>{lead.temperature}</Badge>
              </TD>
              <TD>
                <div className="flex items-center gap-1 text-xs font-semibold">
                  <Sparkles className="size-3 text-amber-500" />
                  <span>{lead.priorityScore}</span>
                </div>
              </TD>
              <TD>
                <span className="text-xs font-medium">
                  {lead.budgetMax
                    ? formatMoney(lead.budgetMax, lead.currency, { compact: true })
                    : "—"}
                </span>
              </TD>
              <TD>
                <span className="text-xs text-muted-foreground">
                  {lead.assignedTo?.name ?? "Unassigned"}
                </span>
              </TD>
              <TD>
                <span className="text-xs text-muted-foreground">{titleCase(lead.source)}</span>
              </TD>
              <TD>
                <span className="text-xs text-muted-foreground">{formatDate(lead.createdAt)}</span>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </TableShell>
  );
}