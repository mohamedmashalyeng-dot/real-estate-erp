"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/form-controls";
import { syncFacebookLeadsAction } from "./facebook-actions";

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" size="sm" variant="outline" loading={pending}>{pending ? null : <RefreshCw className="size-4" />}{pending ? "Syncing…" : "Sync Facebook"}</Button>;
}

export function FacebookSyncButton({ lastSyncedLabel }: { lastSyncedLabel: string | null }) {
  const [state, action] = useActionState(async () => {
    const result = await syncFacebookLeadsAction();
    return { ok: result.ok, message: result.ok ? result.message : result.error };
  }, null);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <Submit />
      <div aria-live="polite" className="max-w-sm text-right text-xs text-muted-foreground">
        {state?.ok === false ? <FieldError>{state.message}</FieldError> : state?.ok ? <p>{state.message}</p> : lastSyncedLabel ? <p>Last synced {lastSyncedLabel}</p> : null}
      </div>
    </form>
  );
}
