"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrgSwitcher } from "./org-switcher";
import { UserNav } from "./user-nav";
import { SidebarNav } from "./sidebar-nav";
import type { SessionUser, MembershipSummary } from "@/lib/context";

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
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex print:hidden">
        {/* Brand header */}
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            <span className="text-sm font-bold">EstateIQ</span>
          </Link>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
            ERP
          </span>
        </div>

        {/* Org Switcher */}
        <div className="border-b border-sidebar-border p-3">
          <OrgSwitcher currentOrgId={currentOrgId} memberships={memberships} />
        </div>

        {/* Navigation */}
        <SidebarNav permissions={permissions} />

        {/* User menu footer */}
        <div className="border-t border-sidebar-border p-3">
          <UserNav user={user} />
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex w-64 max-w-[80vw] flex-col bg-sidebar border-r border-sidebar-border z-10">
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 font-semibold tracking-tight text-foreground"
              >
                <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Sparkles className="size-4" />
                </div>
                <span className="text-sm font-bold">EstateIQ</span>
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="border-b border-sidebar-border p-3">
              <OrgSwitcher currentOrgId={currentOrgId} memberships={memberships} />
            </div>
            <div className="flex-1 overflow-y-auto" onClick={() => setMobileOpen(false)}>
              <SidebarNav permissions={permissions} />
            </div>
            <div className="border-t border-sidebar-border p-3">
              <UserNav user={user} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden print:overflow-visible">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:hidden print:hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex items-center gap-1.5 font-bold text-sm">
            <Sparkles className="size-4 text-primary" />
            <span>EstateIQ</span>
          </div>
          <div className="size-8" />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}