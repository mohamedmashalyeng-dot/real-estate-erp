"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/form-controls";
import { Button } from "@/components/ui/button";
import { LEAD_STAGES, LEAD_SOURCES } from "@/lib/constants";
import { titleCase } from "@/lib/format";

export function LeadFilters({
  stages = LEAD_STAGES,
  sources = LEAD_SOURCES,
}: {
  stages?: readonly string[];
  sources?: readonly string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [draftSearch, setDraftSearch] = useState(searchParams.get("search") ?? "");

  const stage = searchParams.get("stage") ?? "ALL";
  const source = searchParams.get("source") ?? "ALL";
  const temperature = searchParams.get("temperature") ?? "ALL";
  const urlSearch = searchParams.get("search") ?? "";

  function updateQuery(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page"); // reset pagination on filter change
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "ALL") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    startTransition(() => {
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  const hasFilters = urlSearch || stage !== "ALL" || source !== "ALL" || temperature !== "ALL";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-xs md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <form
          className="relative min-w-[200px] flex-1 md:max-w-xs"
          onSubmit={(event) => {
            event.preventDefault();
            updateQuery({ search: draftSearch.trim() || null });
          }}
        >
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            onBlur={() => {
              if ((draftSearch.trim() || "") !== urlSearch) {
                updateQuery({ search: draftSearch.trim() || null });
              }
            }}
            placeholder="Search name, phone, email..."
            className="pl-8 text-xs"
          />
        </form>

        <Select
          value={stage}
          onChange={(event) => updateQuery({ stage: event.target.value })}
          className="w-[140px] text-xs"
          disabled={isPending}
        >
          <option value="ALL">All Stages</option>
          {stages.map((item) => (
            <option key={item} value={item}>
              {titleCase(item)}
            </option>
          ))}
        </Select>

        <Select
          value={source}
          onChange={(event) => updateQuery({ source: event.target.value })}
          className="w-[140px] text-xs"
          disabled={isPending}
        >
          <option value="ALL">All Sources</option>
          {sources.map((item) => (
            <option key={item} value={item}>
              {titleCase(item)}
            </option>
          ))}
        </Select>

        <Select
          value={temperature}
          onChange={(event) => updateQuery({ temperature: event.target.value })}
          className="w-[130px] text-xs"
          disabled={isPending}
        >
          <option value="ALL">All Temps</option>
          <option value="HOT">🔥 Hot</option>
          <option value="WARM">☀️ Warm</option>
          <option value="COLD">❄️ Cold</option>
        </Select>

        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraftSearch("");
              router.push(pathname);
            }}
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
