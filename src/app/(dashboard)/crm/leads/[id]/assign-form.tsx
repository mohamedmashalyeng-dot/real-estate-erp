"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldError, FormField, Select } from "@/components/ui/form-controls";
import { assignLeadAction } from "../followup-actions";

function AssignSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending} variant="secondary">
      Assign
    </Button>
  );
}

export function LeadAssignForm({
  leadId,
  agents,
  currentAssigneeId,
  canAssign,
}: {
  leadId: string;
  agents: { id: string; name: string }[];
  currentAssigneeId: string | null;
  canAssign: boolean;
}) {
  const router = useRouter();

  const [state, formAction] = useActionState(
    async (
      _prev: { ok: boolean; error?: string; fieldErrors?: Record<string, string[]> },
      formData: FormData,
    ) => {
      const result = await assignLeadAction(leadId, String(formData.get("assignedToId") ?? ""));
      if (!result.ok) {
        return { ok: false as const, error: result.error, fieldErrors: result.fieldErrors };
      }
      router.refresh();
      return { ok: true as const };
    },
    { ok: true as const },
  );

  if (!canAssign) return null;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <FormField
        label="Assign agent"
        htmlFor="lead-assignee"
        className="min-w-44 flex-1"
        error={state.fieldErrors?.assignedToId}
      >
        <Select id="lead-assignee" name="assignedToId" defaultValue={currentAssigneeId ?? ""}>
          <option value="">Unassigned</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </Select>
      </FormField>
      <AssignSubmit />
      {state.ok === false && state.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}
