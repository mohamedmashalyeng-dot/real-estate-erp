"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Select } from "@/components/ui/form-controls";
import { completeFollowUpAction } from "../followup-actions";

function FollowUpStatusSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="icon-sm" disabled={pending} title="Update follow-up">
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
      <span className="sr-only">Update follow-up</span>
    </Button>
  );
}

export function FollowUpStatusForm({
  leadId,
  followUpId,
  status: initialStatus,
  canManage,
}: {
  leadId: string;
  followUpId: string;
  status: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("COMPLETED");
  const [outcome, setOutcome] = useState("");

  const [state, formAction] = useActionState(
    async (
      _prev: { ok: boolean; error?: string; fieldErrors?: Record<string, string[]> },
      formData: FormData,
    ) => {
      const result = await completeFollowUpAction(leadId, followUpId, {
        status: String(formData.get("status") ?? "COMPLETED"),
        outcome: String(formData.get("outcome") ?? ""),
      });
      if (!result.ok) {
        return { ok: false as const, error: result.error, fieldErrors: result.fieldErrors };
      }
      setOutcome("");
      router.refresh();
      return { ok: true as const };
    },
    { ok: true as const },
  );

  if (!canManage || initialStatus !== "PENDING") return null;

  return (
    <form action={formAction} className="min-w-72 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Select
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-8 min-w-28 text-xs"
          aria-label="Follow-up status"
        >
          <option value="COMPLETED">Complete</option>
          <option value="MISSED">Missed</option>
          <option value="CANCELLED">Cancel</option>
        </Select>
        <Input
          name="outcome"
          value={outcome}
          onChange={(event) => setOutcome(event.target.value)}
          placeholder="Outcome"
          maxLength={2000}
          className="h-8 text-xs"
          aria-label="Follow-up outcome"
        />
        <FollowUpStatusSubmit />
      </div>
      {state.ok === false ? (
        <FieldError>{state.fieldErrors?.status?.[0] ?? state.fieldErrors?.outcome?.[0] ?? state.error}</FieldError>
      ) : null}
    </form>
  );
}
