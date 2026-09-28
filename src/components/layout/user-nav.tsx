"use client";

import { signOut } from "next-auth/react";
import { LogOut, Shield } from "lucide-react";
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

export function UserNav({ user }: { user: SessionUser }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left text-xs text-sidebar-foreground transition hover:bg-sidebar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <Avatar name={user.name} src={user.image} className="size-7" />
          <div className="min-w-0 flex-1 truncate">
            <p className="truncate font-medium leading-none">{user.name}</p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{user.email}</p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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
