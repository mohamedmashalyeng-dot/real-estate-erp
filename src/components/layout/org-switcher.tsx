"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import type { MembershipSummary } from "@/lib/context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";

export function OrgSwitcher({
  currentOrgId,
  memberships,
}: {
  currentOrgId: string;
  memberships: MembershipSummary[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const current = memberships.find((m) => m.organizationId === currentOrgId) ?? memberships[0];

  function handleSelect(orgId: string) {
    if (orgId === currentOrgId) return;
    // eslint-disable-next-line react-hooks/immutability -- Persisting the selected organization cookie is the intended side effect.
    document.cookie = `estateiq.active_org=${orgId}; path=/; max-age=31536000; SameSite=Lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isPending}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/60 px-2.5 py-2 text-left text-xs text-sidebar-foreground transition hover:bg-sidebar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:opacity-50"
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-semibold text-[11px]">
              {current?.organizationName?.[0]?.toUpperCase() ?? "O"}
            </div>
            <div className="min-w-0 truncate">
              <p className="truncate font-medium leading-none">{current?.organizationName ?? "Select Org"}</p>
              <p className="mt-1 truncate text-[11px] text-sidebar-muted">{current?.roleName ?? "Member"}</p>
            </div>
          </div>
          <ChevronsUpDown className="size-4 shrink-0 text-sidebar-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        {memberships.map((m) => {
          const isSelected = m.organizationId === currentOrgId;
          return (
            <DropdownMenuItem
              key={m.organizationId}
              onClick={() => handleSelect(m.organizationId)}
              className="flex items-center justify-between"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Building2 className="size-4 shrink-0 text-muted-foreground" />
                <div className="truncate">
                  <p className="truncate font-medium">{m.organizationName}</p>
                  <p className="text-[11px] text-muted-foreground">{m.roleName}</p>
                </div>
              </div>
              {isSelected ? <Check className="size-4 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
          Currency: <span className="font-semibold text-foreground">{current?.organizationCurrency}</span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
