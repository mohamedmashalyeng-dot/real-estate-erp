"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/overlays";
import { Input } from "@/components/ui/form-controls";
import { NAV_SECTIONS } from "./sidebar-nav";

export function QuickNavigation({ permissions }: { permissions: string[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen((value) => !value); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);
  const items = NAV_SECTIONS.flatMap((section) => section.items).filter((item) => (!item.permission || permissions.includes(item.permission)) && item.title.toLowerCase().includes(query.trim().toLowerCase()));
  return <Dialog open={open} onOpenChange={setOpen}>
    <button type="button" onClick={() => { setQuery(""); setOpen(true); }} className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background/70 px-3 text-sm text-muted-foreground transition hover:border-primary/40 hover:bg-card" aria-label="Find a page"><Search className="size-4" /><span className="hidden sm:inline">Jump to a page…</span><kbd className="ml-6 hidden rounded border border-border px-1.5 py-0.5 font-sans text-[10px] sm:inline">Ctrl K</kbd></button>
    <DialogContent className="gap-4 p-5 sm:max-w-lg">
      <div><DialogTitle>Where would you like to go?</DialogTitle><DialogDescription>Search the pages available in your workspace.</DialogDescription></div>
      <Input aria-label="Search pages" placeholder="Leads, sales, settings…" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="max-h-[50vh] space-y-1 overflow-y-auto">{items.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="group flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition hover:bg-primary/8 focus-visible:bg-primary/8"><span className="rounded-lg bg-muted p-2 text-primary"><item.icon className="size-4" /></span><span className="flex-1 font-medium">{item.title}</span><ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary" /></Link>)}{!items.length ? <p className="p-6 text-center text-sm text-muted-foreground">No matching pages. Try another name.</p> : null}</div>
    </DialogContent>
  </Dialog>;
}
