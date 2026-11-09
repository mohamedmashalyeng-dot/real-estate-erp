"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/form-controls";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/form-controls";
import { LEAD_STAGES } from "@/lib/constants";
import { titleCase } from "@/lib/format";
import { updateLeadStageAction } from "../actions";

function StageSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending} variant="secondary">
      Update
    </Button>
  );
}

export function LeadStageSelector({
  leadId,
  currentStage,
  canUpdate,
}: {
  leadId: string;
  currentStage: string;
  canUpdate: boolean;
}) {
  const router = useRouter();

  const [state, formAction] = useActionState(
    async (
      _prev: { ok: boolean; error?: string } | null,
      formData: FormData,
    ): Promise<{ ok: boolean; error?: string } | null> => {
      const stage = String(formData.get("stage") ?? "");
      const result = await updateLeadStageAction(leadId, stage);
      router.refresh();
      if (!result.ok) return { ok: false, error: result.error };
      return null;
    },
    null,
  );

  if (!canUpdate) {
    return <span className="text-xs font-semibold text-foreground">{titleCase(currentStage)}</span>;
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Stage:</span>
      <Select name="stage" defaultValue={currentStage} className="h-8 w-36 text-xs font-semibold">
        {LEAD_STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {titleCase(stage)}
          </option>
        ))}
      </Select>
      <StageSubmit />
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}
