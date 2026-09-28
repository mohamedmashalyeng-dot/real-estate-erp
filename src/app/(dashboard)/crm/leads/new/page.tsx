import { requirePermission } from "@/lib/context";
import { PageHeader } from "@/components/ui/data-display";
import { Card, CardContent } from "@/components/ui/card";
import { NewLeadForm } from "./new-lead-form";

export const metadata = { title: "New Lead" };

export default async function NewLeadPage() {
  const context = await requirePermission("leads.create");

  const agents = await context.db.user.findMany({
    where: {
      status: "ACTIVE",
      memberships: { some: { organizationId: context.organizationId, status: "ACTIVE" } },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Create Lead"
        description="Capture a new prospect manually. Assignment notifies the agent immediately."
      />
      <Card>
        <CardContent>
          <NewLeadForm agents={agents} />
        </CardContent>
      </Card>
    </div>
  );
}
