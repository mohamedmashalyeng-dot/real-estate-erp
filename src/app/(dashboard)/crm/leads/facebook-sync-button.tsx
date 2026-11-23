"use client";
import { useActionState } from "react";
import { RefreshCw, Check, CircleAlert, Plus, Copy, Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncFacebookLeadsAction } from "./facebook-actions";

export function FacebookSyncButton({ lastSyncedLabel }: { lastSyncedLabel: string | null }) {
  const [state, action, pending] = useActionState(async () => syncFacebookLeadsAction(), null);
  return <form action={action} className="flex max-w-full flex-col gap-2 sm:items-end">
    <Button type="submit" size="sm" variant="outline" loading={pending}>{!pending ? <RefreshCw className="size-4" /> : null}{pending ? "Importing leads…" : "Sync Facebook"}</Button>
    <div aria-live="polite" className="max-w-sm text-xs">
      {pending ? <p className="text-muted-foreground">Checking your forms. Existing leads stay untouched.</p> : state?.ok ? <div role="status" className="rounded-xl border border-success/20 bg-success/5 p-3"><p className="mb-2 flex items-center gap-1.5 font-medium text-emerald-700 dark:text-success"><Check className="size-3.5" />Import complete</p><div className="flex flex-wrap gap-3 text-muted-foreground"><span className="flex items-center gap-1"><Plus className="size-3" /><strong className="text-foreground">{state.data.created}</strong> new</span><span className="flex items-center gap-1"><Copy className="size-3" />{state.data.unchanged} already here</span><span className="flex items-center gap-1"><Files className="size-3" />{state.data.forms} forms</span></div></div> : state && !state.ok ? <p role="alert" className="flex items-start gap-1.5 rounded-xl bg-destructive/8 p-3 text-destructive"><CircleAlert className="size-4 shrink-0" />{state.error}</p> : lastSyncedLabel ? <p className="text-muted-foreground">Last sync: {lastSyncedLabel}</p> : null}
    </div>
  </form>;
}
