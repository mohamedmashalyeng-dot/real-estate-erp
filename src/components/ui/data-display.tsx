import * as React from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  primary: "border-primary/20 bg-primary/10 text-primary",
  success: "border-success/25 bg-success/10 text-emerald-700 dark:text-success",
  warning: "border-warning/30 bg-warning/15 text-amber-700 dark:text-warning",
  danger: "border-destructive/25 bg-destructive/10 text-destructive",
  info: "border-info/25 bg-info/10 text-sky-700 dark:text-info",
};

const dotTones: Record<BadgeTone, string> = {
  neutral: "bg-muted-foreground/60",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
};

/** "UNDER_CONSTRUCTION" → "Under construction"; other text is left alone. */
function humanizeEnum(children: React.ReactNode): React.ReactNode {
  if (typeof children !== "string" || !/^[A-Z][A-Z0-9_ ]*$/.test(children)) return children;
  const text = children.replace(/[_ ]+/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap",
        badgeTones[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", dotTones[tone])} /> : null}
      {humanizeEnum(children)}
    </span>
  );
}

export function Separator({
  className,
  orientation = "horizontal",
}: {
  className?: string;
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <div
      role="separator"
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
    />
  );
}

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
  );
}

export function TableShell({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("table-scroll rounded-lg border border-border bg-card", className)} {...props} />
  );
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table
      className={cn("w-full min-w-[720px] border-collapse text-sm", className)}
      {...props}
    />
  );
}

export function THead({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      className={cn("bg-muted/50 text-[11px] uppercase tracking-wider", className)}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody
      className={cn("divide-y divide-border [&>tr]:transition-colors [&>tr:hover]:bg-muted/40", className)}
      {...props}
    />;
}

export function TR({
  className,
  interactive = false,
  ...props
}: React.ComponentProps<"tr"> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        interactive ? "transition-colors hover:bg-accent/50" : undefined,
        className,
      )}
      {...props}
    />
  );
}

export function TH({
  className,
  align = "left",
  ...props
}: React.ComponentProps<"th"> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-3 py-2.5 text-left font-semibold text-muted-foreground",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  align = "left",
  ...props
}: React.ComponentProps<"td"> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "px-3 py-3 align-middle",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}) {
  return (
    <header className="flex flex-col gap-2">
      {breadcrumbs?.length ? (
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={`${crumb.label}-${index}`}>
              {index > 0 ? <span className="text-border">/</span> : null}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span>{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description ? (
            <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {Icon ? (
        <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      ) : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
      <p className="text-sm font-medium text-destructive">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

type StatTone = "primary" | "success" | "warning" | "danger" | "info" | "neutral";

const statIconTones: Record<StatTone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/12 text-emerald-600 dark:text-success",
  warning: "bg-warning/15 text-amber-600 dark:text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/12 text-sky-600 dark:text-info",
  neutral: "bg-muted text-muted-foreground",
};

export function StatCard({
  label,
  value,
  hint,
  delta,
  deltaLabel,
  icon: Icon,
  tone = "primary",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
  deltaLabel?: string;
  icon?: LucideIcon;
  tone?: StatTone;
  href?: string;
}) {
  const showDelta = typeof delta === "number" && Number.isFinite(delta);
  const positive = (delta ?? 0) >= 0;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", statIconTones[tone])}>
            <Icon className="size-[18px]" />
          </span>
        ) : null}
      </div>
      <p className="-mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      {showDelta || deltaLabel || hint ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          {showDelta ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
                positive ? "bg-success/12 text-positive" : "bg-destructive/10 text-negative",
              )}
            >
              {positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(delta ?? 0).toFixed(1)}%
            </span>
          ) : null}
          {deltaLabel ? <span className="text-muted-foreground">{deltaLabel}</span> : null}
          {hint ? <span className="text-muted-foreground">{hint}</span> : null}
        </div>
      ) : null}
    </>
  );
  const className =
    "block rounded-xl border border-border bg-card px-4 py-4 shadow-card transition-shadow";
  return href ? (
    <Link href={href} className={cn(className, "hover:border-primary/30 hover:shadow-raised")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function DefinitionList({
  items,
  className,
}: {
  items: { label: string; value: React.ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">
            {item.label}
          </dt>
          <dd className="mt-0.5 truncate text-sm text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}