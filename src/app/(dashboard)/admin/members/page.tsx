import { notFound } from "next/navigation";
import { ShieldCheck, UserCheck, UserPlus, Users } from "lucide-react";
import { Badge, PageHeader, StatCard, Table, TableShell, TBody, TD, TH, THead, TR } from "@/components/ui/data-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganization } from "@/lib/context";
import { hasPermission, permissionLabel } from "@/lib/permissions";
import { formatDate, formatNumber } from "@/lib/format";

export const metadata = { title: "Members" };

export default async function MembersPage() {
  const context = await requireOrganization();
  if (!hasPermission(context.permissions, "users.manage")) notFound();

  const [memberships, roles, pendingInvites, activeMembers] = await Promise.all([
    context.db.membership.findMany({
      orderBy: [{ status: "asc" }, { joinedAt: "desc" }],
      take: 100,
      include: {
        user: { select: { name: true, email: true, jobTitle: true, status: true } },
        role: { select: { name: true, slug: true } },
      },
    }),
    context.db.role.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: { permissions: { include: { permission: true } }, _count: { select: { memberships: true } } },
    }),
    context.db.invitation.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { role: { select: { name: true } } },
    }),
    context.db.membership.count({ where: { status: "ACTIVE" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administration"
        description="Team access, active roles, permission coverage, and pending invitations."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Members" value={formatNumber(activeMembers)} icon={Users} />
        <StatCard label="Roles" value={formatNumber(roles.length)} icon={ShieldCheck} />
        <StatCard label="Pending Invites" value={formatNumber(pendingInvites.length)} icon={UserPlus} />
        <StatCard label="Your Role" value={context.membership.roleName} icon={UserCheck} />
      </div>

      <Card>
        <CardHeader><CardTitle>Members</CardTitle></CardHeader>
        <CardContent>
          <TableShell>
            <Table>
              <THead>
                <TR><TH>Name</TH><TH>Email</TH><TH>Role</TH><TH>Status</TH><TH>Joined</TH></TR>
              </THead>
              <TBody>
                {memberships.map((membership) => (
                  <TR key={membership.id}>
                    <TD className="font-medium">{membership.user.name}</TD>
                    <TD>{membership.user.email}</TD>
                    <TD>{membership.role.name}</TD>
                    <TD><Badge tone={membership.status === "ACTIVE" && membership.user.status === "ACTIVE" ? "success" : "neutral"}>{membership.status}</Badge></TD>
                    <TD>{formatDate(membership.joinedAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableShell>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Roles & Permissions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {roles.map((role) => (
            <div key={role.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{role.name}</p>
                <Badge tone={role.isSystem ? "primary" : "neutral"}>{role._count.memberships} members</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {role.permissions.map((entry) => permissionLabel(entry.permission.key)).join(", ")}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pending Invitations</CardTitle></CardHeader>
        <CardContent>
          {pendingInvites.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No pending invitations.</p>
          ) : (
            <TableShell>
              <Table>
                <THead><TR><TH>Email</TH><TH>Role</TH><TH>Expires</TH><TH>Status</TH></TR></THead>
                <TBody>
                  {pendingInvites.map((invite) => (
                    <TR key={invite.id}>
                      <TD>{invite.email}</TD>
                      <TD>{invite.role.name}</TD>
                      <TD>{formatDate(invite.expiresAt)}</TD>
                      <TD><Badge tone="warning">{invite.status}</Badge></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableShell>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
