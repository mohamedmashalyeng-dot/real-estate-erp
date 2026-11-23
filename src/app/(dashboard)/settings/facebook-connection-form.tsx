"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { FieldError, FormField, Input } from "@/components/ui/form-controls";
import { connectFacebookPageAction, disconnectFacebookPageAction } from "./facebook-actions";

type State = { ok: boolean; message: string } | null;

function Submit({ connected, disabled }: { connected: boolean; disabled: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" size="sm" loading={pending} disabled={disabled}>{pending ? "Connecting…" : connected ? "Update connection" : "Connect Facebook Page"}</Button>;
}

export function FacebookConnectionForm({ pageId, pageName, missingConfiguration }: {
  pageId: string | null;
  pageName: string | null;
  missingConfiguration: string[];
}) {
  const [state, action] = useActionState(async (_previous: State, formData: FormData): Promise<State> => {
    const result = formData.get("intent") === "disconnect"
      ? await disconnectFacebookPageAction()
      : await connectFacebookPageAction(formData);
    return { ok: result.ok, message: result.ok ? result.message ?? "Saved." : result.error };
  }, null);
  const disabled = missingConfiguration.length > 0;
  return (
    <form action={action} className="space-y-4">
      {pageId ? <p className="text-sm font-medium">Connected Page: {pageName ?? pageId}</p> : null}
      {disabled ? <FieldError>Server setup required: {missingConfiguration.join(", ")}. Ask your administrator to configure these before connecting.</FieldError> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Facebook Page ID" htmlFor="facebook-page-id" hint="The numeric ID of the Page that owns your lead forms.">
          <Input key={pageId} id="facebook-page-id" name="pageId" inputMode="numeric" pattern="[0-9]+" defaultValue={pageId ?? ""} required disabled={disabled} />
        </FormField>
        <FormField label="Page access token" htmlFor="facebook-page-token" hint={pageId ? "Leave blank to keep the saved token, or paste a replacement token." : "Use a Page token with leads access. It is stored encrypted."}>
          <Input id="facebook-page-token" name="pageToken" type="password" autoComplete="new-password" required={!pageId} disabled={disabled} />
        </FormField>
      </div>
      <div className="flex flex-wrap gap-2">
        <Submit connected={Boolean(pageId)} disabled={disabled} />
        {pageId ? <Disconnect /> : null}
      </div>
      <div aria-live="polite">
        {state?.ok === false ? <FieldError>{state.message}</FieldError> : state?.ok ? <p className="text-sm text-foreground">{state.message}</p> : null}
      </div>
    </form>
  );
}

function Disconnect() {
  const { pending } = useFormStatus();
  return <Button type="submit" name="intent" value="disconnect" variant="outline" size="sm" formNoValidate disabled={pending}>Disconnect</Button>;
}
