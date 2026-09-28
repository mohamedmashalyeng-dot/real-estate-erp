"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FormField, FormRow, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/form-controls";
import { LEAD_SOURCES } from "@/lib/constants";
import { createLeadAction } from "./actions";

const initialState: { ok: boolean; error?: string; fieldErrors?: Record<string, string[]> } = {
  ok: true,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Create Lead
    </Button>
  );
}

export function NewLeadForm({
  agents,
}: {
  agents: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result = await createLeadAction(formData);
    if (!result.ok) {
      return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
    }
    return { ok: true as const };
  }, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.ok === false && state.error ? <FieldError>{state.error}</FieldError> : null}

      <FormRow>
        <FormField label="First name" htmlFor="firstName" required error={state.fieldErrors?.firstName}>
          <Input id="firstName" name="firstName" autoComplete="given-name" required maxLength={80} />
        </FormField>
        <FormField label="Last name" htmlFor="lastName" required error={state.fieldErrors?.lastName}>
          <Input id="lastName" name="lastName" autoComplete="family-name" required maxLength={80} />
        </FormField>
        <FormField label="Phone" htmlFor="phone" required error={state.fieldErrors?.phone}>
          <Input id="phone" name="phone" autoComplete="tel" required placeholder="+2010…" maxLength={32} />
        </FormField>
      </FormRow>

      <FormRow>
        <FormField label="Email" htmlFor="email" error={state.fieldErrors?.email}>
          <Input id="email" name="email" type="email" autoComplete="email" maxLength={160} />
        </FormField>
        <FormField label="City" htmlFor="city">
          <Input id="city" name="city" maxLength={64} />
        </FormField>
        <FormField label="Country" htmlFor="country">
          <Input id="country" name="country" maxLength={64} />
        </FormField>
      </FormRow>

      <FormRow>
        <FormField label="Budget min" htmlFor="budgetMin">
          <Input id="budgetMin" name="budgetMin" type="number" min={0} step="1000" />
        </FormField>
        <FormField label="Budget max" htmlFor="budgetMax">
          <Input id="budgetMax" name="budgetMax" type="number" min={0} step="1000" />
        </FormField>
        <FormField label="Source" htmlFor="source">
          <Select id="source" name="source" defaultValue="OTHER">
            {LEAD_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </Select>
        </FormField>
      </FormRow>

      <FormRow className="lg:grid-cols-2">
        <FormField label="Temperature" htmlFor="temperature">
          <Select id="temperature" name="temperature" defaultValue="COLD">
            <option value="HOT">Hot</option>
            <option value="WARM">Warm</option>
            <option value="COLD">Cold</option>
          </Select>
        </FormField>
        <FormField label="Assign agent" htmlFor="assignedToId">
          <Select id="assignedToId" name="assignedToId" defaultValue="">
            <option value="">Unassigned</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </Select>
        </FormField>
      </FormRow>

      <FormField label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={4} maxLength={4000} />
      </FormField>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
