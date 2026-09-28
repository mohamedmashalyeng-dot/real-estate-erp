"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldError, FormField, Input, Select, Textarea } from "@/components/ui/form-controls";
import { createFollowUpAction } from "../followup-actions";

function FollowUpSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      Schedule
    </Button>
  );
}

function defaultDueAt(): string {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function LeadFollowUpForm({
  leadId,
  canManage,
}: {
  leadId: string;
  canManage: boolean;
}) {
  const router = useRouter();

  const [state, formAction] = useActionState(
    async (
      _prev: { ok: boolean; error?: string; fieldErrors?: Record<string, string[]> },
      formData: FormData,
    ) => {
      const result = await createFollowUpAction({
        leadId,
        type: String(formData.get("type") ?? "CALL"),
        dueAt: String(formData.get("dueAt") ?? ""),
        priority: String(formData.get("priority") ?? "MEDIUM"),
        notes: String(formData.get("notes") ?? ""),
      });
      if (!result.ok) {
        return { ok: false as const, error: result.error, fieldErrors: result.fieldErrors };
      }
      router.refresh();
      return { ok: true as const };
    },
    { ok: true as const },
  );

  if (!canManage) return null;

  return (
    <form action={formAction} className="space-y-3">
      {state.ok === false && state.error ? <FieldError>{state.error}</FieldError> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Type" htmlFor="followup-type" error={state.fieldErrors?.type}>
          <Select id="followup-type" name="type" defaultValue="CALL">
            <option value="CALL">Call</option>
            <option value="MEETING">Meeting</option>
            <option value="EMAIL">Email</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="VIEWING">Viewing</option>
            <option value="OTHER">Other</option>
          </Select>
        </FormField>
        <FormField label="Due at" htmlFor="followup-due" required error={state.fieldErrors?.dueAt}>
          <Input id="followup-due" name="dueAt" type="datetime-local" defaultValue={defaultDueAt()} required />
        </FormField>
        <FormField label="Priority" htmlFor="followup-priority" error={state.fieldErrors?.priority}>
          <Select id="followup-priority" name="priority" defaultValue="MEDIUM">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </Select>
        </FormField>
      </div>
      <FormField label="Notes" htmlFor="followup-notes" error={state.fieldErrors?.notes}>
        <Textarea id="followup-notes" name="notes" rows={2} maxLength={2000} className="resize-none text-xs" />
      </FormField>
      <div className="flex justify-end">
        <FollowUpSubmit />
      </div>
    </form>
  );
}
