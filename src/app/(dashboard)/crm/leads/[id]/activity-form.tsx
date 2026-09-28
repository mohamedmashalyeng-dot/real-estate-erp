"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldError, FormField, Input, Select, Textarea } from "@/components/ui/form-controls";
import { addLeadNoteAction } from "../actions";

function NoteSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending} disabled={disabled}>
      Log Activity
    </Button>
  );
}

export function LeadActivityForm({
  leadId,
  canLog,
}: {
  leadId: string;
  canLog: boolean;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("NOTE");

  const [state, formAction] = useActionState(
    async (
      _prev: { ok: boolean; error?: string; fieldErrors?: Record<string, string[]> },
      formData: FormData,
    ) => {
      const result = await addLeadNoteAction(leadId, {
        subject: String(formData.get("subject") ?? ""),
        body: String(formData.get("body") ?? ""),
        type: String(formData.get("type") ?? "NOTE"),
      });
      if (!result.ok) {
        return { ok: false as const, error: result.error, fieldErrors: result.fieldErrors };
      }
      setSubject("");
      setBody("");
      setType("NOTE");
      router.refresh();
      return { ok: true as const };
    },
    { ok: true as const },
  );

  if (!canLog) return null;

  return (
    <form action={formAction} className="space-y-3">
      {state.ok === false && state.error ? <FieldError>{state.error}</FieldError> : null}
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <FormField label="Type" htmlFor="activity-type" error={state.fieldErrors?.type}>
          <Select id="activity-type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="CALL">Call</option>
            <option value="MEETING">Meeting</option>
            <option value="EMAIL">Email</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="NOTE">Note</option>
          </Select>
        </FormField>
        <FormField label="Subject" htmlFor="activity-subject" required error={state.fieldErrors?.subject}>
          <Input
            id="activity-subject"
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Call outcome, site visit summary…"
            maxLength={160}
          />
        </FormField>
      </div>
      <FormField label="Details" htmlFor="activity-body" error={state.fieldErrors?.body}>
        <Textarea
          id="activity-body"
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Log an interaction, phone call summary, or meeting notes…"
          rows={3}
          maxLength={4000}
          className="resize-none text-xs"
        />
      </FormField>
      <div className="flex justify-end">
        <NoteSubmit disabled={!subject.trim()} />
      </div>
    </form>
  );
}
