"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Check, ChevronDown, CircleAlert, ExternalLink, KeyRound, Link2, LockKeyhole, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/overlays";
import { connectFacebookPageAction, disconnectFacebookPageAction } from "./facebook-actions";

type State = { ok: boolean; message: string } | null;

function Submit({ connected, disabled }: { connected: boolean; disabled: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending} disabled={disabled}>{pending ? "Checking your Page…" : connected ? "Save connection" : "Connect my Page"}{!pending ? <ArrowRight className="size-4" /> : null}</Button>;
}

function DisconnectPage() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (): Promise<State> => {
    const result = await disconnectFacebookPageAction();
    if (result.ok) setOpen(false);
    return { ok: result.ok, message: result.ok ? result.message ?? "Disconnected." : result.error };
  }, null);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button type="button" size="sm" variant="ghost" className="text-muted-foreground"><Unplug className="size-3.5" />Disconnect</Button></DialogTrigger><DialogContent className="sm:max-w-md"><DialogTitle>Disconnect this Facebook Page?</DialogTitle><DialogDescription>New Facebook submissions will stop syncing. Every lead already in your CRM will stay exactly as it is.</DialogDescription><form action={action} className="space-y-4"><div aria-live="polite">{state?.ok === false ? <p className="text-sm text-destructive">{state.message}</p> : null}</div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Keep connected</Button><Button type="submit" variant="destructive" loading={pending}>Disconnect Page</Button></div></form></DialogContent></Dialog>;
}

export function FacebookConnectionForm({ pageId, pageName, missingConfiguration, lastSyncedLabel }: {
  pageId: string | null; pageName: string | null; missingConfiguration: string[]; lastSyncedLabel?: string | null;
}) {
  const [draftPageId, setDraftPageId] = useState(pageId ?? "");
  const [state, action] = useActionState(async (_previous: State, formData: FormData): Promise<State> => {
    const result = await connectFacebookPageAction(formData);
    return { ok: result.ok, message: result.ok ? result.message ?? "Page connected." : result.error };
  }, null);
  const disabled = missingConfiguration.length > 0;
  return <div className="space-y-5">
    {pageId ? <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-success/20 bg-success/5 p-5"><div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-2xl bg-success/12 text-success"><Check className="size-5" /></span><div><p className="flex items-center gap-2 text-sm font-semibold">{pageName ?? "Your Facebook Page"}<span className="rounded-full bg-success/12 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-success">Connected</span></p><p className="mt-1 text-xs text-muted-foreground">{lastSyncedLabel ? `Last sync: ${lastSyncedLabel}` : "Ready for your first import"}</p></div></div><Button asChild size="sm"><Link href="/crm/leads?source=FACEBOOK">Open Facebook leads<ArrowRight className="size-4" /></Link></Button></div> : <div className="grid gap-3 sm:grid-cols-2">{[{ icon: Link2, title: "1. Choose your Page", text: "In Meta Graph API Explorer, select your app and then your Facebook Page." }, { icon: KeyRound, title: "2. Copy the Page token", text: "Copy Access Token at the top of Meta’s screen, then paste it below." }].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl border border-border bg-muted/30 p-4"><Icon className="mb-3 size-5 text-primary" /><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p></div>)}</div>}
    {disabled ? <div role="alert" className="flex gap-3 rounded-xl border border-warning/30 bg-warning/8 p-4 text-sm"><CircleAlert className="size-5 shrink-0 text-warning" /><div><p className="font-medium">A quick server setup is needed</p><p className="mt-1 text-xs text-muted-foreground">Your administrator needs to configure: {missingConfiguration.join(", ")}.</p></div></div> : null}
    <details open={!pageId} className="group rounded-2xl border border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium">{pageId ? "Manage connection" : "Connect your Facebook Page"}<ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" /></summary>
      <form action={action} className="space-y-5 border-t border-border p-4 sm:p-5">
        <div className="grid gap-5 md:grid-cols-2">
          <FormField label="Facebook Page ID" htmlFor="facebook-page-id" hint="Find the numeric ID next to your Page name in Meta."><Input id="facebook-page-id" name="pageId" inputMode="numeric" pattern="[0-9]{1,32}" maxLength={32} value={draftPageId} onChange={(event) => setDraftPageId(event.target.value)} placeholder="e.g. 1199396266586272" required disabled={disabled} /></FormField>
          <FormField label="Page access token" htmlFor="facebook-page-token" hint={pageId ? "Leave empty to keep your saved token. Paste a new Page token only when updating it." : "Use the Page token copied from Meta Graph API Explorer. Your webhook verify token belongs in Meta’s webhook setup."}><Input id="facebook-page-token" name="pageToken" type="password" autoComplete="new-password" spellCheck={false} maxLength={8192} placeholder={pageId ? "Saved token stays protected" : "Paste your Facebook Page token"} required={!pageId} disabled={disabled} /></FormField>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4"><Submit connected={Boolean(pageId)} disabled={disabled} /><a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">Get a token from Meta<ExternalLink className="size-3.5" /></a></div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><LockKeyhole className="size-3.5 shrink-0" />Your token is encrypted when saved and is never displayed again.</p>
      </form>
    </details>
    <div aria-live="polite">{state ? <div role={state.ok ? "status" : "alert"} className={`flex items-start gap-2 rounded-xl p-3 text-sm ${state.ok ? "bg-success/8 text-emerald-700 dark:text-success" : "bg-destructive/8 text-destructive"}`}>{state.ok ? <Check className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}<span>{state.message}</span></div> : null}</div>
    {pageId ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"><p className="text-xs text-muted-foreground">Run an import from Leads to bring in available submissions.</p><DisconnectPage /></div> : null}
  </div>;
}
