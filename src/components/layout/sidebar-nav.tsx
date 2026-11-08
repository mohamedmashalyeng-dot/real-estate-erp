"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building,
  KeyRound,
  Calculator,
  Receipt,
  Megaphone,
  BarChart3,
  Sparkles,
  Settings,
  ShieldCheck,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PermissionKey } from "@/lib/permissions";

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  permission?: PermissionKey;
  badge?: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        title: "CRM & Leads",
        href: "/crm/leads",
        icon: Users,
        permission: "leads.view",
      },
      {
        title: "Projects & Units",
        href: "/inventory/projects",
        icon: Building,
        permission: "projects.view",
      },
      {
        title: "Reservations & Sales",
        href: "/sales",
        icon: KeyRound,
        permission: "sales.view",
      },
      {
        title: "Payment Calculator",
        href: "/sales/calculator",
        icon: Calculator,
        permission: "sales.view",
      },
      {
        title: "Finance & Plans",
        href: "/finance/installments",
        icon: Receipt,
        permission: "payments.view",
      },
      {
        title: "Marketing",
        href: "/marketing/campaigns",
        icon: Megaphone,
        permission: "marketing.view",
      },
      {
        title: "Reports",
        href: "/reports",
        icon: BarChart3,
        permission: "reports.view",
      },
    ],
  },
  {
    title: "Intelligence & Platform",
    items: [
      {
        title: "EstateIQ AI",
        href: "/ai/assistant",
        icon: Sparkles,
        permission: "ai.use",
      },
      {
        title: "Administration",
        href: "/admin/members",
        icon: ShieldCheck,
        permission: "users.manage",
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        permission: "settings.manage",
      },
    ],
  },
];

export function SidebarNav({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const permSet = new Set(permissions);
  // Highlight only the most specific match (e.g. /sales/calculator, not /sales too).
  const activeHref = NAV_SECTIONS.flatMap((section) => section.items)
    .map((item) => item.href)
    .filter((href) => pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav className="flex flex-1 flex-col gap-5 px-3 py-4">
      {NAV_SECTIONS.map((section, idx) => {
        const visibleItems = section.items.filter(
          (item) => !item.permission || permSet.has(item.permission),
        );
        if (visibleItems.length === 0) return null;

        return (
          <div key={idx} className="flex flex-col gap-1">
            {section.title ? (
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                {section.title}
              </p>
            ) : null}
            {visibleItems.map((item) => {
              const active = item.href === activeHref;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-xs"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={cn("size-4 shrink-0", active ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground")} />
                    <span>{item.title}</span>
                  </div>
                  {item.badge ? (
                    <span className="rounded bg-primary/20 px-1.5 py-0.2 text-[10px] text-primary">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}