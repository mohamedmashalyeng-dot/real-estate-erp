import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAGE_SIZE_OPTIONS } from "@/lib/constants";
import { Button } from "./button";

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}

function buildHref(
  basePath: string,
  searchParams: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...searchParams, ...overrides })) {
    if (value !== undefined && value !== "") params.set(key, value);
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(page, 1), pageCount);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>
          {from}–{to} of {total}
        </span>
        <span className="text-border">|</span>
        <span className="flex items-center gap-1">
          Rows
          <span className="flex items-center gap-0.5">
            {PAGE_SIZE_OPTIONS.map((option) => (
              <Link
                key={option}
                href={buildHref(basePath, searchParams, {
                  page: "1",
                  pageSize: String(option),
                })}
                className={cn(
                  "rounded px-1.5 py-0.5 tabular-nums transition-colors hover:bg-accent",
                  option === pageSize && "bg-accent font-medium text-foreground",
                )}
              >
                {option}
              </Link>
            ))}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Button asChild variant="outline" size="icon-sm" disabled={current <= 1}>
          <Link
            href={buildHref(basePath, searchParams, { page: String(current - 1) })}
            aria-label="Previous page"
            className={current <= 1 ? "pointer-events-none opacity-50" : undefined}
          >
            <ChevronLeft />
          </Link>
        </Button>
        <span className="tabular-nums">
          Page {current} / {pageCount}
        </span>
        <Button asChild variant="outline" size="icon-sm" disabled={current >= pageCount}>
          <Link
            href={buildHref(basePath, searchParams, { page: String(current + 1) })}
            aria-label="Next page"
            className={
              current >= pageCount ? "pointer-events-none opacity-50" : undefined
            }
          >
            <ChevronRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}