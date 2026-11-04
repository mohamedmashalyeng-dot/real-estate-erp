"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/form-controls";
import { syncLeadsSheetAction } from "./sheet-actions";

function SyncSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" loading={pending}>
      {pending ? null : <RefreshCw className="size-4" />}
      <span>{pending ? "Syncing…" : "Sync Google Sheet"}</span>
    </Button>
  );
}

type SyncState = { ok: boolean; message?: string; warnings?: string[] } | null;

export function SheetSyncButton({ lastSyncedLabel }: { lastSyncedLabel: string | null }) {
  const router = useRouter();

  const [state, formAction] = useActionState(async (): Promise<SyncState> => {
    const result = await syncLeadsSheetAction();
    if (!result.ok) return { ok: false, message: result.error };
    router.refresh();
    const warnings = [
      result.data.unmatchedConsultants.length
        ? `Not assigned (no team member named): ${result.data.unmatchedConsultants.join(", ")}`
        : null,
      result.data.unmatchedProjects.length
        ? `Project not linked (no project named): ${result.data.unmatchedProjects.join(", ")}`
        : null,
    ].filter((warning): warning is string => warning !== null);
    return { ok: true, message: result.message, warnings };
  }, null);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <SyncSubmit />
      {state?.ok === false ? (
        <FieldError>{state.message}</FieldError>
      ) : state?.ok ? (
        <div className="max-w-sm text-right text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{state.message}</p>
          {state.warnings?.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      ) : lastSyncedLabel ? (
        <p className="text-xs text-muted-foreground">Last synced {lastSyncedLabel}</p>
      ) : null}
    </form>
  );
}
