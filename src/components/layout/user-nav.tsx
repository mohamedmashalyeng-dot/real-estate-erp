"use client";

import { signOut } from "next-auth/react";
import { ChevronsUpDown, LogOut, Moon, Shield, Sun } from "lucide-react";
import type { SessionUser } from "@/lib/context";
import { Avatar } from "@/components/ui/overlays";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";

function toggleTheme() {
  const dark = !document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem("estateiq.theme", dark ? "dark" : "light");
  } catch {
    // Storage can be unavailable (private mode); the toggle still applies.
  }
}

export function UserNav({ user }: { user: SessionUser }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left text-xs text-sidebar-foreground transition hover:bg-sidebar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <Avatar name={user.name} src={user.image} className="size-8 border-sidebar-border bg-sidebar-primary text-sidebar-primary-foreground" />
          <div className="min-w-0 flex-1 truncate">
            <p className="truncate font-medium leading-tight">{user.name}</p>
            <p className="mt-0.5 truncate text-[11px] leading-tight text-sidebar-muted">{user.email}</p>
          </div>
          <ChevronsUpDown className="size-4 shrink-0 text-sidebar-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-xs font-semibold leading-none">{user.name}</p>
            <p className="text-[11px] text-muted-foreground leading-none">{user.email}</p>
            {user.jobTitle ? (
              <p className="text-[10px] text-muted-foreground italic">{user.jobTitle}</p>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.isPlatformAdmin ? (
          <DropdownMenuItem disabled>
            <Shield className="size-4 text-primary" />
            <span>Platform Admin</span>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={(event) => { event.preventDefault(); toggleTheme(); }}>
          <Moon className="size-4 dark:hidden" />
          <Sun className="hidden size-4 dark:block" />
          <span className="dark:hidden">Dark mode</span>
          <span className="hidden dark:inline">Light mode</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <LogOut className="size-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
