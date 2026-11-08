import { notFound } from "next/navigation";
import { requireOrganization } from "@/lib/context";
import { hasPermission } from "@/lib/permissions";
import { LeadAssignmentCard, LeadHeader, LeadProfileCard } from "./lead-profile";
import { LeadTimeline } from "./lead-timeline";
import { LeadQualificationCard } from "./lead-sidecards";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Lead ${id.slice(0, 8)}` };
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireOrganization();
  if (!hasPermission(context.permissions, "leads.view")) notFound();
  const canUpdate = hasPermission(context.permissions, "leads.update");
  const canManageFollowUps = hasPermission(context.permissions, "followups.manage");

  const lead = await context.db.lead.findUnique({
    where: { id, organizationId: context.organizationId },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      preferredProject: { select: { id: true, name: true } },
      campaign: { select: { id: true, name: true, platform: true } },
    },
  });
  if (!lead) notFound();

  const [activities, followUps, agents] = await Promise.all([
    context.db.leadActivity.findMany({
      where: { leadId: id, organizationId: context.organizationId },
      orderBy: { occurredAt: "desc" },
      take: 100,
      include: { user: { select: { id: true, name: true } } },
    }),
    context.db.followUp.findMany({
      where: { leadId: id, organizationId: context.organizationId },
      orderBy: { dueAt: "asc" },
      take: 100,
      include: {
        assignedTo: { select: { id: true, name: true } },
        completedBy: { select: { id: true, name: true } },
      },
    }),
    canUpdate
      ? context.db.user.findMany({
          where: {
            status: "ACTIVE",
            memberships: { some: { organizationId: context.organizationId, status: "ACTIVE" } },
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 200,
        })
      : Promise.resolve([]),
  ]);

  const pendingCount = followUps.filter((followUp) => followUp.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <LeadHeader lead={lead} canUpdate={canUpdate} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <LeadProfileCard lead={lead} />
          <LeadTimeline
            leadId={lead.id}
            activities={activities}
            followUps={followUps}
            canLog={canUpdate}
            canManageFollowUps={canManageFollowUps}
          />
        </div>
        <div className="space-y-6">
          {canUpdate ? <LeadAssignmentCard leadId={lead.id} assignedToId={lead.assignedToId} agents={agents} /> : null}
          <LeadQualificationCard lead={lead} pendingCount={pendingCount} canUpdate={canUpdate} />
        </div>
      </div>
    </div>
  );
}
