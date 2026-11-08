import { Badge } from "@/components/ui/data-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatRelative, titleCase } from "@/lib/format";
import { LeadScoreForm } from "./lead-score-form";

export function LeadQualificationCard({
  lead,
  pendingCount,
  canUpdate,
}: {
  lead: {
    id: string;
    stage: string;
    temperature: string;
    priorityScore: number;
    score: number;
    source: string;
    nextFollowUpAt: Date | null;
  };
  pendingCount: number;
  canUpdate: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Qualification</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Stage</span>
          <Badge tone="primary">{lead.stage}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Temperature</span>
          <Badge
            tone={
              lead.temperature === "HOT" ? "danger" : lead.temperature === "WARM" ? "warning" : "neutral"
            }
          >
            {lead.temperature}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Priority score</span>
          <span className="font-semibold text-foreground">{lead.priorityScore}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Manual score</span>
          <span className="font-semibold text-foreground">{lead.score}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Source</span>
          <span className="font-medium text-foreground">{titleCase(lead.source)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Pending follow-ups</span>
          <span className="font-semibold text-foreground">{pendingCount}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Next follow-up</span>
          <span className="text-right font-medium text-foreground">
            {lead.nextFollowUpAt
              ? `${formatDateTime(lead.nextFollowUpAt)} (${formatRelative(lead.nextFollowUpAt)})`
              : "—"}
          </span>
        </div>
        <LeadScoreForm
          leadId={lead.id}
          score={lead.score}
          temperature={lead.temperature}
          canUpdate={canUpdate}
        />
      </CardContent>
    </Card>
  );
}
