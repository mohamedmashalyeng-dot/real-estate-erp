import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { testDatabaseUrl } from "../scripts/lib/dev-db-config";
import { parseCsv } from "@/lib/google-sheets";
import {
  deriveSheetStage,
  detectSheetColumns,
  mapSheetRow,
  matchProjectName,
  mergeSheetLeads,
  normalizeSheetPhone,
  parseSheetDateTime,
  syncLeadsFromSheet,
} from "@/lib/lead-sheet-sync";

// The Prisma client reads DATABASE_URL when it is first imported.
process.env.DATABASE_URL = testDatabaseUrl();
const { prisma, forOrganization } = await import("@/lib/prisma");

const SPREADSHEET_ID = "14Itq_qnX3gQuRrP8cExQxBVsu8sd2vZoMcSbm70zD74";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit?usp=sharing`;

// Header row of the real "Camp Leads & Contact" tracker.
const HEADER =
  '.,DATE,New lead,Phone,time to connect,job title,E-MAIL,Project,Preferred Area (m²),Interested Unit Size,Preferred Payment Plan,Sales Consultant,type Source,Status,Feedback (1),Feedback (2),Feedback (3),Site visit,Yes/ No,Notes';

const ROWS = [
  '1,10/5/2026,سليم,1114166741,10:00 PM,,,Meeting Point,تجاري ,39  mall,تقسيط ,Karim,Ledas WatssApp,Pending,"تم التواصل مع العميل, مهتم ب ""المحلات""\nوحدة 39 متر",العميل تواصل مره اخري,,Scheduled,Qualified,ملحوظات',
  '2,10/10/2026,غير معروف,0,غير واضح,,,Meeting Point,,,,symon,Ledas WatssApp,Follow Up,ولم يظهر رد من العميل,,,,,',
  '3,10/8/2026,"~Ahmed. Hwarey\r\n",966548364504,3:23 PM,,,Park Octoper,شقق غرب القاهره,,,,Socail Organic,New Lead,,,,,Not Qualified,',
  "4,,,,,,,,,,,,,,,,,,,",
];
const EDITED_FIRST_ROW = ROWS[0].replace("ملحوظات", "ملحوظات جديدة");

function csv(rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

function stubSheet(rows: string[]) {
  const htmlview = `items.push({name: "OCT(10) 2026", pageUrl: "x", gid: "299493350"});
    items.push({name: "Dashboard", pageUrl: "x", gid: "786955683"});`;
  const dashboard = "WEST | SALES MANAGEMENT DASHBOARD,,\nTOTAL LEADS,CONTACTED,QUALIFIED\n46,46,15";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/htmlview")) return new Response(htmlview, { headers: { "content-type": "text/html" } });
      const body = url.includes("gid=786955683") ? dashboard : csv(rows);
      return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8" } });
    }),
  );
}

describe("sheet parsing", () => {
  it("parses quoted CSV fields with commas, quotes and newlines", () => {
    expect(parseCsv('a,"b, ""c""\nd",e\r\nf,,g')).toEqual([
      ["a", 'b, "c"\nd', "e"],
      ["f", "", "g"],
    ]);
  });

  it("detects the lead header and ignores dashboard tabs", () => {
    const detected = detectSheetColumns(parseCsv(csv([])));
    expect(detected?.headerRow).toBe(0);
    expect(detected?.columns.fields).toMatchObject({ serial: 0, date: 1, name: 2, phone: 3, notes: 19, qualification: 18 });
    expect(detected?.columns.feedback.map((entry) => entry.label)).toEqual(["Feedback (1)", "Feedback (2)", "Feedback (3)"]);
    expect(detectSheetColumns(parseCsv("TOTAL LEADS,QUALIFIED\n46,15"))).toBeNull();
  });

  it("normalizes phone numbers, restoring the Egyptian prefix", () => {
    expect(normalizeSheetPhone("1114166741")).toBe("+201114166741");
    expect(normalizeSheetPhone("01114166741")).toBe("+201114166741");
    expect(normalizeSheetPhone("+20 111 416 6741")).toBe("+201114166741");
    expect(normalizeSheetPhone("00971569173944")).toBe("+971569173944");
    expect(normalizeSheetPhone("966548364504")).toBe("+966548364504");
    expect(normalizeSheetPhone("0")).toBeNull();
    expect(normalizeSheetPhone("")).toBeNull();
  });

  it("reads dates as wall-clock time in the organization timezone", () => {
    // Cairo is UTC+3 until the end of October 2026 (summer time), UTC+2 after.
    expect(parseSheetDateTime("10/5/2026", "10:00 PM", "Africa/Cairo")?.toISOString()).toBe("2026-10-05T19:00:00.000Z");
    expect(parseSheetDateTime("11/5/2026", "10:30 P", "Africa/Cairo")?.toISOString()).toBe("2026-11-05T20:30:00.000Z");
    expect(parseSheetDateTime("25/10/2026", "", "UTC")?.toISOString()).toBe("2026-10-25T12:00:00.000Z");
    expect(parseSheetDateTime("", "10:00 PM", "UTC")).toBeNull();
  });

  it("derives the pipeline stage from status, site visit and qualification", () => {
    expect(deriveSheetStage("New Lead", "", "").stage).toBe("NEW");
    expect(deriveSheetStage("Pending", "", "").stage).toBe("NEW");
    expect(deriveSheetStage("Follow Up", "", "").stage).toBe("CONTACTED");
    expect(deriveSheetStage("New Lead", "", "Qualified").stage).toBe("QUALIFIED");
    expect(deriveSheetStage("Pending", "Scheduled", "Qualified").stage).toBe("VIEWING");
    expect(deriveSheetStage("New Lead", "", "Not Qualified")).toEqual({ stage: "LOST", lostReason: "Not qualified" });
    expect(deriveSheetStage("Closed Won", "", "Qualified").stage).toBe("WON");
  });

  it("maps a row and skips empty ones", () => {
    const rows = parseCsv(csv(ROWS));
    const { columns } = detectSheetColumns(rows)!;
    const options = { spreadsheetId: SPREADSHEET_ID, tab: { name: "OCT(10) 2026", gid: "1" }, timeZone: "Africa/Cairo" };

    const first = mapSheetRow(rows[1], columns, { ...options, rowNumber: 2 })!;
    expect(first).toMatchObject({
      key: "gsheet:phone:+201114166741",
      firstName: "سليم",
      lastName: "",
      source: "WHATSAPP",
      stage: "VIEWING",
      propertyType: "RETAIL",
      projectName: "Meeting Point",
      consultantName: "Karim",
    });
    expect(first.feedback).toHaveLength(2);
    expect(first.notes).toContain("Payment plan: تقسيط");

    const unknown = mapSheetRow(rows[2], columns, { ...options, rowNumber: 3 })!;
    expect(unknown).toMatchObject({ key: `gsheet:${SPREADSHEET_ID}:1:row:2`, firstName: null, phone: null });

    const third = mapSheetRow(rows[3], columns, { ...options, rowNumber: 4 })!;
    expect(third).toMatchObject({ firstName: "Ahmed.", lastName: "Hwarey", source: "OTHER", stage: "LOST" });

    expect(mapSheetRow(rows[4], columns, { ...options, rowNumber: 5 })).toBeNull();
  });

  it("merges rows of the same phone and keeps all feedback", () => {
    const rows = parseCsv(csv([ROWS[0], ROWS[0].replace("1,10/5/2026", "9,10/9/2026")]));
    const { columns } = detectSheetColumns(rows)!;
    const options = { spreadsheetId: SPREADSHEET_ID, tab: { name: "OCT", gid: "1" }, timeZone: "UTC" };
    const merged = mergeSheetLeads([
      mapSheetRow(rows[1], columns, { ...options, rowNumber: 2 })!,
      mapSheetRow(rows[2], columns, { ...options, rowNumber: 3 })!,
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].feedback).toHaveLength(4);
    expect(merged[0].createdAt?.toISOString()).toBe("2026-10-05T22:00:00.000Z");
  });

  it("matches project names exactly or with a single typo", () => {
    const projects = [
      { id: "mp", name: "Meeting Point" },
      { id: "po", name: "Park October" },
      { id: "t1", name: "Tower 1" },
    ];
    expect(matchProjectName("meeting point ", projects)).toBe("mp");
    expect(matchProjectName("Park Octoper", projects)).toBe("po");
    expect(matchProjectName("Tower 2", projects)).toBeNull();
    expect(matchProjectName("Park Octoberrr", projects)).toBeNull();
    expect(
      matchProjectName("Park Octobar", [...projects, { id: "po2", name: "Park Octobor" }]),
    ).toBeNull();
  });
});

describe("syncLeadsFromSheet", () => {
  const suffix = Date.now().toString(36);
  let organizationId: string;
  let karimId: string;

  beforeAll(async () => {
    const organization = await prisma.organization.create({
      data: { name: `Sheet Sync ${suffix}`, slug: `sheet-sync-${suffix}`, timezone: "Africa/Cairo" },
    });
    organizationId = organization.id;
    const role = await prisma.role.create({ data: { organizationId, name: "Agent", slug: "agent" } });
    const karim = await prisma.user.create({
      data: { name: "Karim Zaki", email: `karim-${suffix}@example.test`, passwordHash: "x" },
    });
    karimId = karim.id;
    await prisma.membership.create({ data: { organizationId, userId: karim.id, roleId: role.id } });
    await prisma.project.create({ data: { organizationId, name: "Meeting Point" } });
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@example.test` } } });
    await prisma.$disconnect();
  });

  const run = () =>
    syncLeadsFromSheet({
      db: forOrganization(organizationId),
      organizationId,
      userId: null,
      sheetUrl: SHEET_URL,
      timeZone: "Africa/Cairo",
    });

  it("creates leads, then leaves unchanged rows alone", async () => {
    stubSheet(ROWS);
    const first = await run();
    expect(first).toMatchObject({ tabs: ["OCT(10) 2026"], created: 3, updated: 0, unchanged: 0 });
    expect(first.unmatchedConsultants).toEqual(["symon"]);
    expect(first.unmatchedProjects).toEqual(["Park Octoper"]);

    const lead = await prisma.lead.findFirstOrThrow({
      where: { organizationId, phone: "+201114166741" },
      include: { activities: true, preferredProject: true },
    });
    expect(lead.assignedToId).toBe(karimId);
    expect(lead.preferredProject?.name).toBe("Meeting Point");
    expect(lead.stage).toBe("VIEWING");
    expect(lead.createdAt.toISOString()).toBe("2026-10-05T19:00:00.000Z");
    expect(lead.activities.filter((activity) => activity.type === "NOTE")).toHaveLength(2);

    const second = await run();
    expect(second).toMatchObject({ created: 0, updated: 0, unchanged: 3 });
  });

  it("re-applies edited rows without duplicating feedback or moving stages backwards", async () => {
    const lead = await prisma.lead.findFirstOrThrow({ where: { organizationId, phone: "+201114166741" } });
    await prisma.lead.update({ where: { id: lead.id }, data: { stage: "NEGOTIATION" } });

    stubSheet([EDITED_FIRST_ROW, ...ROWS.slice(1)]);
    const result = await run();
    expect(result).toMatchObject({ created: 0, updated: 1, unchanged: 2 });

    const updated = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id }, include: { activities: true } });
    expect(updated.stage).toBe("NEGOTIATION");
    expect(updated.notes).toContain("ملحوظات جديدة");
    expect(updated.activities.filter((activity) => activity.type === "NOTE")).toHaveLength(2);
    expect(updated.activities.filter((activity) => activity.type === "SYSTEM")).toHaveLength(1);
  });

  it("re-links a row when its missing phone is filled in", async () => {
    stubSheet([EDITED_FIRST_ROW, ROWS[1].replace("غير معروف,0", "منى,01030032052"), ROWS[2]]);
    const result = await run();
    expect(result).toMatchObject({ created: 0, updated: 1, unchanged: 2 });
    const relinked = await prisma.lead.findFirstOrThrow({ where: { organizationId, phone: "+201030032052" } });
    expect(relinked).toMatchObject({ firstName: "منى", externalRef: "gsheet:phone:+201030032052" });
    expect(await prisma.lead.count({ where: { organizationId } })).toBe(3);
  });

  it("links unchanged rows to a consultant or project added after the first sync", async () => {
    const role = await prisma.role.findFirstOrThrow({ where: { organizationId } });
    const symon = await prisma.user.create({
      data: { name: "Symon", email: `symon-${suffix}@example.test`, passwordHash: "x" },
    });
    await prisma.membership.create({ data: { organizationId, userId: symon.id, roleId: role.id } });
    await prisma.project.create({ data: { organizationId, name: "Park October" } });

    stubSheet([EDITED_FIRST_ROW, ROWS[1].replace("غير معروف,0", "منى,01030032052"), ROWS[2]]);
    const result = await run();
    expect(result).toMatchObject({ created: 0, updated: 2, unchanged: 1, unmatchedConsultants: [], unmatchedProjects: [] });

    const mona = await prisma.lead.findFirstOrThrow({ where: { organizationId, phone: "+201030032052" } });
    expect(mona.assignedToId).toBe(symon.id);
    const ahmed = await prisma.lead.findFirstOrThrow({
      where: { organizationId, phone: "+966548364504" },
      include: { preferredProject: true },
    });
    expect(ahmed.preferredProject?.name).toBe("Park October");

    expect(await run()).toMatchObject({ created: 0, updated: 0, unchanged: 3 });
  });
});
