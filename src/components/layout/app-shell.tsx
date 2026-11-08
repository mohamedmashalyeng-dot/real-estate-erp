"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrgSwitcher } from "./org-switcher";
import { UserNav } from "./user-nav";
import { SidebarNav } from "./sidebar-nav";
import type { SessionUser, MembershipSummary } from "@/lib/context";

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/dashboard"
      onClick={onNavigate}
      className="flex items-center gap-2.5 font-semibold tracking-tight text-sidebar-accent-foreground"
    >
      <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-black/20">
        <Building2 className="size-[18px]" />
      </div>
      <div className="leading-none">
        <span className="block text-[15px] font-bold">EstateIQ</span>
        <span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-sidebar-muted">
          Real Estate ERP
        </span>
      </div>
    </Link>
  );
}

export function AppShell({
  user,
  memberships,
  currentOrgId,
  permissions,
  children,
}: {
  user: SessionUser;
  memberships: MembershipSummary[];
  currentOrgId: string;
  permissions: string[];
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex print:hidden">
        <div className="flex h-16 items-center px-5">
          <Brand />
        </div>
        <div className="px-3 pb-1">
          <OrgSwitcher currentOrgId={currentOrgId} memberships={memberships} />
        </div>
        <SidebarNav permissions={permissions} />
        <div className="border-t border-sidebar-border p-3">
          <UserNav user={user} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 flex w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-2xl">
            <div className="flex h-16 items-center justify-between px-5">
              <Brand onNavigate={() => setMobileOpen(false)} />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="px-3 pb-1">
              <OrgSwitcher currentOrgId={currentOrgId} memberships={memberships} />
            </div>
            <div className="flex flex-1 flex-col overflow-y-auto" onClick={() => setMobileOpen(false)}>
              <SidebarNav permissions={permissions} />
            </div>
            <div className="border-t border-sidebar-border p-3">
              <UserNav user={user} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col print:overflow-visible">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur md:hidden print:hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex items-center gap-2 text-sm font-bold">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Building2 className="size-3.5" />
            </div>
            <span>EstateIQ</span>
          </div>
          <div className="size-8" />
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 print:p-0">
          <div className="mx-auto w-full max-w-[1440px] space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
