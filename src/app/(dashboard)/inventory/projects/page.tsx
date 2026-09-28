import { notFound } from "next/navigation";
import { Building, Home, KeyRound, MapPin } from "lucide-react";
import { Badge, PageHeader, StatCard, Table, TableShell, TBody, TD, TH, THead, TR } from "@/components/ui/data-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganization } from "@/lib/context";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { formatArea, formatMoney, formatNumber } from "@/lib/format";

export const metadata = { title: "Projects & Units" };

export default async function ProjectsPage() {
  const context = await requireOrganization();
  if (!hasAnyPermission(context.permissions, ["projects.view", "units.view"])) notFound();

  const [projects, units, totalProjects, totalUnits, availableUnits, reservedUnits] = await Promise.all([
    context.db.project.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { _count: { select: { units: true, buildings: true } } },
      take: 100,
    }),
    context.db.unit.findMany({
      orderBy: [{ status: "asc" }, { unitCode: "asc" }],
      take: 100,
      include: { project: { select: { name: true } }, building: { select: { name: true } } },
    }),
    context.db.project.count(),
    context.db.unit.count(),
    context.db.unit.count({ where: { status: "AVAILABLE" } }),
    context.db.unit.count({ where: { status: "RESERVED" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects & Units"
        description="Portfolio availability, project delivery status, and unit pricing in one operational view."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Projects" value={formatNumber(totalProjects)} icon={Building} />
        <StatCard label="Units" value={formatNumber(totalUnits)} icon={Home} />
        <StatCard label="Available" value={formatNumber(availableUnits)} icon={KeyRound} />
        <StatCard label="Reserved" value={formatNumber(reservedUnits)} icon={MapPin} />
      </div>

      <Card>
        <CardHeader><CardTitle>Projects</CardTitle></CardHeader>
        <CardContent>
          <TableShell>
            <Table>
              <THead>
                <TR><TH>Name</TH><TH>Location</TH><TH>Status</TH><TH>Units</TH><TH>Buildings</TH><TH align="right">Starting price</TH></TR>
              </THead>
              <TBody>
                {projects.map((project) => (
                  <TR key={project.id}>
                    <TD className="font-medium">{project.name}</TD>
                    <TD>{[project.locationCity, project.locationCountry].filter(Boolean).join(", ") || "-"}</TD>
                    <TD><Badge tone={project.status === "READY" ? "success" : "neutral"}>{project.status}</Badge></TD>
                    <TD>{project._count.units}</TD>
                    <TD>{project._count.buildings}</TD>
                    <TD align="right">{formatMoney(project.startingPrice, project.currency)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableShell>
        </CardContent>
      </Card>

      {hasPermission(context.permissions, "units.view") ? (
        <Card>
          <CardHeader><CardTitle>Unit Inventory</CardTitle></CardHeader>
          <CardContent>
            <TableShell>
              <Table>
                <THead>
                  <TR><TH>Code</TH><TH>Project</TH><TH>Type</TH><TH>Area</TH><TH>Status</TH><TH align="right">Price</TH></TR>
                </THead>
                <TBody>
                  {units.map((unit) => (
                    <TR key={unit.id}>
                      <TD className="font-medium">{unit.unitCode}</TD>
                      <TD>{unit.project.name}</TD>
                      <TD>{unit.type}{unit.bedrooms ? ` - ${unit.bedrooms} BR` : ""}</TD>
                      <TD>{formatArea(unit.areaSqm)}</TD>
                      <TD>
                        <Badge tone={unit.status === "AVAILABLE" ? "success" : unit.status === "RESERVED" ? "warning" : "neutral"}>
                          {unit.status}
                        </Badge>
                      </TD>
                      <TD align="right">{formatMoney(unit.price, unit.currency)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableShell>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
