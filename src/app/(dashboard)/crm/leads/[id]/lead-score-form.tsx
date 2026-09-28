"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, FormField, Input, Select } from "@/components/ui/form-controls";
import { updateLeadScoreAction } from "../followup-actions";

function ScoreSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="icon-sm" disabled={pending} title="Save score">
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
      <span className="sr-only">Save score</span>
    </Button>
  );
}

export function LeadScoreForm({
  leadId,
  score: initialScore,
  temperature: initialTemperature,
  canUpdate,
}: {
  leadId: string;
  score: number;
  temperature: string;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [score, setScore] = useState(String(initialScore));
  const [temperature, setTemperature] = useState(initialTemperature);

  const [state, formAction] = useActionState(
    async (
      _prev: { ok: boolean; error?: string; fieldErrors?: Record<string, string[]> },
      formData: FormData,
    ) => {
      const result = await updateLeadScoreAction(leadId, {
        score: Number(formData.get("score") ?? initialScore),
        temperature: String(formData.get("temperature") ?? initialTemperature),
      });
      if (!result.ok) {
        return { ok: false as const, error: result.error, fieldErrors: result.fieldErrors };
      }
      router.refresh();
      return { ok: true as const };
    },
    { ok: true as const },
  );

  if (!canUpdate) return null;

  return (
    <form action={formAction} className="space-y-2 border-t border-border pt-3">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
        <FormField label="Score" htmlFor="lead-score" error={state.fieldErrors?.score}>
          <Input
            id="lead-score"
            name="score"
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(event) => setScore(event.target.value)}
            className="h-8 text-xs"
          />
        </FormField>
        <FormField label="Temperature" htmlFor="lead-temperature" error={state.fieldErrors?.temperature}>
          <Select
            id="lead-temperature"
            name="temperature"
            value={temperature}
            onChange={(event) => setTemperature(event.target.value)}
            className="h-8 text-xs"
          >
            <option value="HOT">Hot</option>
            <option value="WARM">Warm</option>
            <option value="COLD">Cold</option>
          </Select>
        </FormField>
        <ScoreSubmit />
      </div>
      {state.ok === false && state.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}
