import { Badge } from "@/components/ui/data-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { Table, TableShell, TBody, TD, TH, THead, TR } from "@/components/ui/data-display";
import { formatDateTime } from "@/lib/format";
import { LeadActivityForm } from "./activity-form";
import { LeadFollowUpForm } from "./followup-form";
import { FollowUpStatusForm } from "./followup-status-form";

interface TimelineProps {
  leadId: string;
  activities: {
    id: string;
    type: string;
    subject: string;
    body: string | null;
    occurredAt: Date;
    user: { name: string } | null;
  }[];
  followUps: {
    id: string;
    type: string;
    dueAt: Date;
    status: string;
    priority: string;
    notes: string | null;
    outcome: string | null;
    assignedTo: { name: string };
    completedBy: { name: string } | null;
  }[];
  canLog: boolean;
  canManageFollowUps: boolean;
}

export function LeadTimeline({ leadId, activities, followUps, canLog, canManageFollowUps }: TimelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="activities">
          <TabsList>
            <TabsTrigger value="activities">Activities ({activities.length})</TabsTrigger>
            <TabsTrigger value="followups">Follow-ups ({followUps.length})</TabsTrigger>
            <TabsTrigger value="log">Log activity</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>
          <TabsContent value="activities">
            {activities.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No activities logged yet.
              </p>
            ) : (
              <ol className="space-y-3">
                {activities.map((activity) => (
                  <li key={activity.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{activity.type}</Badge>
                        <p className="text-xs font-semibold text-foreground">{activity.subject}</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDateTime(activity.occurredAt)}
                        {activity.user ? ` · ${activity.user.name}` : ""}
                      </p>
                    </div>
                    {activity.body ? (
                      <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted-foreground">
                        {activity.body}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>
          <TabsContent value="followups">
            {followUps.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No follow-ups scheduled yet.
              </p>
            ) : (
              <TableShell>
                <Table>
                  <THead>
                    <TR>
                      <TH>Type</TH>
                      <TH>Due</TH>
                      <TH>Status</TH>
                      <TH>Priority</TH>
                      <TH>Assignee</TH>
                      <TH>Notes / Outcome</TH>
                      <TH align="right">Action</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {followUps.map((followUp) => (
                      <TR key={followUp.id}>
                        <TD>{followUp.type}</TD>
                        <TD>{formatDateTime(followUp.dueAt)}</TD>
                        <TD>
                          <Badge
                            tone={
                              followUp.status === "COMPLETED"
                                ? "success"
                                : followUp.status === "PENDING"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {followUp.status}
                          </Badge>
                        </TD>
                        <TD>
                          <Badge
                            tone={
                              followUp.priority === "URGENT" || followUp.priority === "HIGH"
                                ? "danger"
                                : followUp.priority === "MEDIUM"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {followUp.priority}
                          </Badge>
                        </TD>
                        <TD>{followUp.assignedTo.name}</TD>
                        <TD className="max-w-64">
                          {followUp.outcome ? (
                            <p className="whitespace-pre-wrap text-xs text-foreground">{followUp.outcome}</p>
                          ) : followUp.notes ? (
                            <p className="whitespace-pre-wrap text-xs text-muted-foreground">{followUp.notes}</p>
                          ) : followUp.completedBy ? (
                            <p className="text-xs text-muted-foreground">Completed by {followUp.completedBy.name}</p>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TD>
                        <TD align="right">
                          <FollowUpStatusForm
                            leadId={leadId}
                            followUpId={followUp.id}
                            status={followUp.status}
                            canManage={canManageFollowUps}
                          />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableShell>
            )}
          </TabsContent>
          <TabsContent value="log">
            <LeadActivityForm leadId={leadId} canLog={canLog} />
          </TabsContent>
          <TabsContent value="schedule">
            <LeadFollowUpForm leadId={leadId} canManage={canManageFollowUps} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
