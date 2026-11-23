"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Building2, ChevronRight, Menu, Moon, Plus, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrgSwitcher } from "./org-switcher";
import { UserNav } from "./user-nav";
import { NAV_SECTIONS, SidebarNav } from "./sidebar-nav";
import { QuickNavigation } from "./quick-navigation";
import type { SessionUser, MembershipSummary } from "@/lib/context";

function Brand() {
  return <Link href="/dashboard" className="flex items-center gap-3 text-sidebar-foreground"><span className="flex size-10 items-center justify-center rounded-2xl bg-sidebar-primary text-white shadow-lg shadow-black/10"><Building2 className="size-5" /></span><span><span className="block text-lg font-bold tracking-tight">EstateIQ<span className="text-sidebar-primary">.</span></span><span className="block text-[10px] uppercase tracking-[0.18em] text-sidebar-muted">Your workspace</span></span></Link>;
}
function ThemeButton() {
  return <Button variant="ghost" size="icon" aria-label="Toggle color theme" onClick={() => {
    const dark = !document.documentElement.classList.contains("dark"); document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("estateiq.theme", dark ? "dark" : "light"); } catch { /* Optional preference storage. */ }
  }}><Sun className="hidden size-4 dark:block" /><Moon className="size-4 dark:hidden" /></Button>;
}
export function AppShell({ user, memberships, currentOrgId, permissions, children }: {
  user: SessionUser; memberships: MembershipSummary[]; currentOrgId: string; permissions: string[]; children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const current = NAV_SECTIONS.flatMap((section) => section.items).filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
  const organization = memberships.find((item) => item.organizationId === currentOrgId);
  const sidebar = <><div className="flex h-24 shrink-0 items-center px-6"><Brand /></div><div className="px-4 pb-2"><OrgSwitcher currentOrgId={currentOrgId} memberships={memberships} /></div><SidebarNav permissions={permissions} onNavigate={() => setMobileOpen(false)} /><div className="mx-4 mb-3 rounded-xl border border-sidebar-border bg-white/3 p-3"><p className="text-[11px] font-medium text-sidebar-foreground">One workspace. Every detail.</p><p className="mt-1 text-[10px] leading-relaxed text-sidebar-muted">Your leads, properties and finances, together.</p></div><div className="border-t border-sidebar-border p-3"><UserNav user={user} /></div></>;
  return <div className="flex min-h-screen bg-background">
    <a href="#main-content" className="sr-only fixed left-4 top-4 z-[100] rounded-xl bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only">Skip to content</a>
    <aside aria-label="Main navigation" className="sticky top-0 hidden h-screen w-[256px] shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex print:hidden">{sidebar}</aside>
    <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in motion-reduce:animate-none lg:hidden" /><Dialog.Content aria-describedby={undefined} className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left-8 motion-reduce:animate-none lg:hidden"><Dialog.Title className="sr-only">Workspace navigation</Dialog.Title><Dialog.Close className="absolute right-3 top-3 rounded-lg p-2 text-sidebar-muted hover:bg-sidebar-accent" aria-label="Close navigation"><X className="size-4" /></Dialog.Close>{sidebar}</Dialog.Content></Dialog.Portal></Dialog.Root>
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-card/85 px-4 backdrop-blur-xl md:px-8 print:hidden">
        <div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="lg:hidden"><Menu className="size-5" /></Button><div className="hidden min-w-0 items-center gap-2 text-sm sm:flex"><span className="max-w-40 truncate text-muted-foreground">{organization?.organizationName}</span><ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" /><span className="truncate font-medium">{current?.title ?? "Workspace"}</span></div><span className="font-semibold sm:hidden">EstateIQ<span className="text-primary">.</span></span></div>
        <div className="flex items-center gap-2"><QuickNavigation permissions={permissions} /><ThemeButton />{permissions.includes("leads.create") ? <Button asChild size="sm" className="hidden sm:inline-flex"><Link href="/crm/leads/new"><Plus className="size-4" />New lead</Link></Button> : null}</div>
      </header>
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 py-7 outline-none md:px-8 md:py-9 print:p-0"><div key={pathname} className="page-enter mx-auto w-full max-w-[1440px] space-y-7">{children}</div></main>
    </div>
  </div>;
}
