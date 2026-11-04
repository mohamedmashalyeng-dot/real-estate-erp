"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldError, FormField, Input } from "@/components/ui/form-controls";
import type { ActionResult } from "@/lib/errors";

function SaveSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      {pending ? "Checking sheet…" : "Save"}
    </Button>
  );
}

type SaveState = {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | null;

/** Google Sheet link field shared by the Settings integrations (field name: `sheetUrl`). */
export function SheetLinkForm({
  id,
  label,
  hint,
  currentUrl,
  action,
}: {
  id: string;
  label: string;
  hint: string;
  currentUrl: string | null;
  action: (formData: FormData) => Promise<ActionResult<unknown>>;
}) {
  const router = useRouter();

  const [state, formAction] = useActionState(
    async (_prev: SaveState, formData: FormData): Promise<SaveState> => {
      const result = await action(formData);
      if (!result.ok) {
        return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
      }
      router.refresh();
      return { ok: true, message: result.message };
    },
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <FormField
          label={label}
          htmlFor={id}
          className="min-w-64 flex-1"
          hint={hint}
          error={state?.fieldErrors?.sheetUrl}
        >
          <Input
            id={id}
            name="sheetUrl"
            type="url"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            defaultValue={currentUrl ?? ""}
          />
        </FormField>
        <SaveSubmit />
      </div>
      {state?.ok === false && state.error && !state.fieldErrors ? <FieldError>{state.error}</FieldError> : null}
      {state?.ok ? <p className="text-xs font-medium text-foreground">{state.message}</p> : null}
    </form>
  );
}
