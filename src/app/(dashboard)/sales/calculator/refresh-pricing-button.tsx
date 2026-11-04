"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/form-controls";
import { refreshPricingSheetAction } from "./actions";

function RefreshSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" loading={pending}>
      {pending ? null : <RefreshCw className="size-4" />}
      <span>{pending ? "Reading sheet…" : "Refresh prices from sheet"}</span>
    </Button>
  );
}

export function RefreshPricingButton({ lastReadLabel }: { lastReadLabel: string | null }) {
  const router = useRouter();

  const [state, formAction] = useActionState(async (): Promise<{ ok: boolean; message?: string } | null> => {
    const result = await refreshPricingSheetAction();
    if (!result.ok) return { ok: false, message: result.error };
    router.refresh();
    return { ok: true, message: result.message };
  }, null);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <RefreshSubmit />
      {state?.ok === false ? (
        <FieldError>{state.message}</FieldError>
      ) : state?.ok ? (
        <p className="text-xs font-medium text-foreground">{state.message}</p>
      ) : lastReadLabel ? (
        <p className="text-xs text-muted-foreground">Last read {lastReadLabel}</p>
      ) : null}
    </form>
  );
}
