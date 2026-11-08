import { requireOrganization } from "@/lib/context";
import { hasPermission } from "@/lib/permissions";
import { REPORT_EXPORTS, buildReport, reportCsv, resolveRange, type ReportExport } from "@/lib/reports";
import { isAppError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const context = await requireOrganization();
    if (!hasPermission(context.permissions, "reports.view")) {
      return new Response("Forbidden", { status: 403 });
    }
    const url = new URL(request.url);
    const kind = url.searchParams.get("type") as ReportExport | null;
    if (!kind || !REPORT_EXPORTS.includes(kind)) {
      return new Response("Unknown report type", { status: 400 });
    }
    const range = resolveRange({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    const report = await buildReport(context.db, range);
    return new Response(reportCsv(report, kind), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${kind}-${range.fromDay}-to-${range.toDay}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (isAppError(error)) return new Response(error.message, { status: error.status });
    console.error("[report-export]", error);
    return new Response("Export failed", { status: 500 });
  }
}
