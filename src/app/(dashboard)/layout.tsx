import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/context";
import { AppShell } from "@/components/layout/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let context;
  try {
    context = await requireOrganization();
  } catch {
    // If unauthenticated or no organization, redirect to login
    redirect("/login");
  }

  return (
    <AppShell
      user={context.user}
      memberships={context.memberships}
      currentOrgId={context.organizationId}
      permissions={context.permissions}
    >
      {children}
    </AppShell>
  );
}
