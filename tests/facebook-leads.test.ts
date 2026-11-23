import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { testDatabaseUrl } from "../scripts/lib/dev-db-config";
import { decryptFacebookToken, encryptFacebookToken, facebookLeadSchema, facebookPages, facebookRequest, verifyFacebookSignature, type FacebookLead } from "@/lib/facebook";
import { importFacebookLead, mapFacebookLead, syncLeadsFromFacebook } from "@/lib/facebook-leads";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/context", () => ({ requirePermission: vi.fn() }));
process.env.DATABASE_URL = testDatabaseUrl();
const { prisma, forOrganization } = await import("@/lib/prisma");
const { GET, POST } = await import("@/app/api/webhooks/facebook/route");
const { connectFacebookPageAction, disconnectFacebookPageAction } = await import("@/app/(dashboard)/settings/facebook-actions");
const { syncFacebookLeadsAction } = await import("@/app/(dashboard)/crm/leads/facebook-actions");
const { requirePermission } = await import("@/lib/context");

const PAGE_ID = "123456789";
const SECRET = "test-app-secret";
const TOKEN = "test-page-token-should-never-leak";
const LEAD: FacebookLead = {
  id: "10001",
  form_id: "20001",
  ad_id: "30001",
  created_time: "2026-11-23T10:30:00+0000",
  field_data: [
    { name: "full_name", values: ["أحمد محمد علي"] },
    { name: "phone_number", values: ["٠١٠١٢٣٤٥٦٧٨"] },
    { name: "email", values: ["ahmed@example.test"] },
    { name: "city", values: ["Cairo"] },
    { name: "country", values: ["EG"] },
    { name: "preferred_project", values: ["West", "East"] },
  ],
};

beforeAll(() => {
  vi.stubEnv("FACEBOOK_APP_SECRET", SECRET);
  vi.stubEnv("FACEBOOK_WEBHOOK_VERIFY_TOKEN", "test-verify-token");
  vi.stubEnv("FACEBOOK_TOKEN_ENCRYPTION_KEY", "ab".repeat(32));
  vi.stubEnv("FACEBOOK_GRAPH_API_VERSION", "v27.0");
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
afterAll(async () => { vi.unstubAllEnvs(); await prisma.$disconnect(); });

function webhookRequest(entries: unknown[], options: { signature?: string; body?: string } = {}) {
  const body = options.body ?? JSON.stringify({ object: "page", entry: entries });
  const signature = options.signature ?? `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`;
  return new Request("https://erp.example.test/api/webhooks/facebook", { method: "POST", body, headers: { "x-hub-signature-256": signature } });
}

function entry(pageId: string = PAGE_ID, leadId = LEAD.id) {
  return { id: pageId, changes: [{ field: "leadgen", value: { page_id: pageId, leadgen_id: leadId, form_id: LEAD.form_id } }] };
}

describe("Facebook data and credential handling", () => {
  it("preserves Arabic names, contact details, submission time and custom answers", () => {
    const mapped = mapFacebookLead(LEAD, PAGE_ID);
    expect(mapped).toMatchObject({ firstName: "أحمد", lastName: "محمد علي", phone: "+201012345678", source: "FACEBOOK", email: "ahmed@example.test", city: "Cairo", country: "EG", externalRef: `facebook:${PAGE_ID}:${LEAD.id}` });
    expect(mapped.createdAt?.toISOString()).toBe("2026-11-23T10:30:00.000Z");
    expect(mapped.notes).toContain("preferred_project: West, East");
  });

  it("supports email-only forms and separately supplied names without inventing contact data", () => {
    expect(mapFacebookLead({ id: "1", field_data: [{ name: "first_name", values: ["Mona"] }, { name: "last_name", values: ["Ali"] }, { name: "email", values: ["bad address"] }] }, PAGE_ID))
      .toMatchObject({ firstName: "Mona", lastName: "Ali", phone: "", email: null });
  });

  it("encrypts tokens with randomized ciphertext and binds decryption to the organization", () => {
    const encrypted = encryptFacebookToken(TOKEN, "org-a");
    expect(encrypted).not.toContain(TOKEN);
    expect(encrypted).not.toBe(encryptFacebookToken(TOKEN, "org-a"));
    expect(decryptFacebookToken(encrypted, "org-a")).toBe(TOKEN);
    expect(() => decryptFacebookToken(encrypted, "org-b")).toThrow("could not be decrypted");
    expect(() => decryptFacebookToken(encrypted.slice(0, -4) + "AAAA", "org-a")).toThrow();
  });

  it("requires a valid signature over the exact raw body", () => {
    const body = '{ "test": true }';
    const signature = `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`;
    expect(verifyFacebookSignature(body, signature, SECRET)).toBe(true);
    expect(verifyFacebookSignature(body.trim() + " ", signature, SECRET)).toBe(false);
    expect(verifyFacebookSignature(body, null, SECRET)).toBe(false);
    expect(verifyFacebookSignature(body, "sha256=bad", SECRET)).toBe(false);
    expect(verifyFacebookSignature(body, signature, "")).toBe(false);
  });

  it("keeps bearer tokens out of URLs and sanitizes upstream token errors", async () => {
    const fetchMock = vi.fn(async () => Response.json({ error: { code: 190, message: `secret ${TOKEN}` } }, { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(facebookRequest(LEAD.id, TOKEN, facebookLeadSchema)).rejects.toThrow("expired or was revoked");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.hostname).toBe("graph.facebook.com");
    expect(url.toString()).not.toContain(TOKEN);
    expect(init.headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
    expect(init.redirect).toBe("error");
  });

  it("refuses incomplete pagination instead of claiming a complete sync", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: [], paging: { next: "https://untrusted.example.test" } })));
    await expect((async () => {
      for await (const page of facebookPages("20001/leads", TOKEN, facebookLeadSchema, "id")) void page;
    })()).rejects.toThrow("pagination could not be completed");
  });
});

describe("Facebook import, webhook and organization integration", () => {
  let organizationId: string;
  let otherOrganizationId: string;
  const suffix = Date.now().toString(36);
  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: "Facebook tests", slug: `facebook-${suffix}`, currency: "USD" } });
    const other = await prisma.organization.create({ data: { name: "Other tenant", slug: `facebook-other-${suffix}` } });
    organizationId = organization.id;
    otherOrganizationId = other.id;
    await prisma.organizationSettings.create({ data: { organizationId, facebookPageId: PAGE_ID, facebookPageAccessToken: encryptFacebookToken(TOKEN, organizationId) } });
  });
  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } });
  });

  const runImport = (lead = LEAD, orgId = organizationId) => importFacebookLead({ db: forOrganization(orgId), organizationId: orgId, currency: "USD", pageId: PAGE_ID, lead });
  const authorize = (orgId = organizationId) => {
    vi.mocked(requirePermission).mockResolvedValue({ db: forOrganization(orgId), organizationId: orgId, currency: "USD", user: { id: null, email: "tester@example.test" } } as unknown as Awaited<ReturnType<typeof requirePermission>>);
  };

  it("imports once under simultaneous requests, then preserves CRM work on retries", async () => {
    const results = await Promise.all([runImport(), runImport(), runImport()]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const saved = await prisma.lead.findFirstOrThrow({ where: { organizationId, externalRef: `facebook:${PAGE_ID}:${LEAD.id}` }, include: { activities: true } });
    expect(saved.currency).toBe("USD");
    expect(saved.activities).toHaveLength(1);
    await prisma.lead.update({ where: { id: saved.id }, data: { stage: "NEGOTIATION", notes: "Sales team notes" } });
    expect(await runImport()).toBe(false);
    expect(await prisma.lead.findUniqueOrThrow({ where: { id: saved.id } })).toMatchObject({ stage: "NEGOTIATION", notes: "Sales team notes" });
  });

  it("keeps the same external lead isolated across tenants", async () => {
    expect(await runImport(LEAD, otherOrganizationId)).toBe(true);
    expect(await forOrganization(organizationId).lead.count()).toBe(1);
    expect(await forOrganization(otherOrganizationId).lead.count()).toBe(1);
  });

  it("paginates both forms and submissions on the Graph host and tolerates backfills after webhooks", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(url.hostname).toBe("graph.facebook.com");
      if (url.pathname.endsWith("/leadgen_forms")) return Response.json(url.searchParams.has("after")
        ? { data: [{ id: "20002", name: "Another form" }] }
        : { data: [{ id: "20001", name: "Form one" }], paging: { next: "https://untrusted.example.test/forms", cursors: { after: "forms-next" } } });
      if (url.pathname.endsWith("/20002/leads")) return Response.json({ data: [{ ...LEAD, id: "10003", form_id: "20002" }] });
      return Response.json(url.searchParams.has("after")
        ? { data: [{ ...LEAD, id: "10002" }] }
        : { data: [LEAD], paging: { next: "https://untrusted.example.test/leads", cursors: { after: "leads-next" } } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const input = { db: forOrganization(organizationId), organizationId, currency: "USD", userId: null, pageId: PAGE_ID, token: TOKEN };
    expect(await syncLeadsFromFacebook(input)).toEqual({ forms: 2, created: 2, unchanged: 1 });
    expect(await syncLeadsFromFacebook(input)).toEqual({ forms: 2, created: 0, unchanged: 3 });
  });

  it("accepts verification only with the configured verify token", async () => {
    expect(await (await GET(new Request("https://erp.test/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=1234"))).text()).toBe("1234");
    expect((await GET(new Request("https://erp.test/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1234"))).status).toBe(403);
  });

  it("rejects unsigned, tampered, malformed and unexpected-object notifications before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await POST(webhookRequest([entry()], { signature: "sha256=" + "0".repeat(64) }))).status).toBe(403);
    expect((await POST(webhookRequest([], { body: "{" }))).status).toBe(400);
    expect((await POST(webhookRequest([], { body: JSON.stringify({ object: "user", entry: [] }) }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("commits deliveries to the connected tenant and deduplicates repeated notifications", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ...LEAD, id: "10004" }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await POST(webhookRequest([entry(PAGE_ID, "10004")]))).status).toBe(200);
    expect((await POST(webhookRequest([entry(PAGE_ID, "10004")]))).status).toBe(200);
    expect(await prisma.lead.count({ where: { organizationId, externalRef: `facebook:${PAGE_ID}:10004` } })).toBe(1);
    expect(await prisma.lead.count({ where: { organizationId: otherOrganizationId, externalRef: `facebook:${PAGE_ID}:10004` } })).toBe(0);
    const saved = await prisma.lead.findFirstOrThrow({ where: { organizationId, externalRef: `facebook:${PAGE_ID}:10004` }, include: { activities: true } });
    expect(saved.activities).toHaveLength(1);
    expect((await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId } })).facebookLeadsSyncedAt).not.toBeNull();
  });

  it("ignores unknown Pages, mismatched Page IDs and unrelated changes", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await POST(webhookRequest([entry("999999999")]))).status).toBe(200);
    expect((await POST(webhookRequest([{ id: PAGE_ID, changes: [{ field: "leadgen", value: { page_id: "999999999", leadgen_id: LEAD.id } }, { field: "feed", value: {} }] }]))).status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a retryable failure on retrieval errors and imports on redelivery", async () => {
    const consoleMock = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: 2 } }, { status: 503 })));
    expect((await POST(webhookRequest([entry(PAGE_ID, "10005")]))).status).toBe(500);
    expect(await prisma.lead.count({ where: { organizationId, externalRef: `facebook:${PAGE_ID}:10005` } })).toBe(0);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ...LEAD, id: "10005" })));
    expect((await POST(webhookRequest([entry(PAGE_ID, "10005")]))).status).toBe(200);
    consoleMock.mockRestore();
  });

  it("rejects connection and sync actions without the required permissions", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new Error("Permission denied"));
    const consoleMock = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await connectFacebookPageAction(new FormData())).ok).toBe(false);
    expect(requirePermission).toHaveBeenCalledWith("settings.manage");
    expect((await syncFacebookLeadsAction()).ok).toBe(false);
    expect(requirePermission).toHaveBeenCalledWith("leads.create");
    expect((await disconnectFacebookPageAction()).ok).toBe(false);
    consoleMock.mockRestore();
  });

  it("connects a Page with encrypted credentials, subscribes leadgen and returns no token", async () => {
    authorize(otherOrganizationId);
    const fetchMock = vi.fn(async (url: URL) => {
      if (url.pathname.endsWith("/me")) return Response.json({ id: "987654321", name: "West Realty" });
      if (url.pathname.endsWith("/leadgen_forms")) return Response.json({ data: [] });
      expect(url.pathname).toBe("/v27.0/987654321/subscribed_apps");
      expect(url.searchParams.get("subscribed_fields")).toBe("leadgen");
      return Response.json({ success: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    const form = new FormData();
    form.set("pageId", "987654321");
    form.set("pageToken", TOKEN);
    const result = await connectFacebookPageAction(form);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain(TOKEN);
    const settings = await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId: otherOrganizationId } });
    expect(settings.facebookPageName).toBe("West Realty");
    expect(settings.facebookPageAccessToken).not.toContain(TOKEN);
    expect(decryptFacebookToken(settings.facebookPageAccessToken!, otherOrganizationId)).toBe(TOKEN);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { organizationId: otherOrganizationId, action: "FACEBOOK_PAGE_CONNECT" } });
    expect(JSON.stringify(audit.metadata)).not.toContain(TOKEN);
  });

  it("rejects a user/wrong Page token without changing the saved connection", async () => {
    authorize(otherOrganizationId);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ id: "555", name: "Wrong Page" })));
    const form = new FormData();
    form.set("pageId", "987654321"); form.set("pageToken", TOKEN);
    expect(await connectFacebookPageAction(form)).toMatchObject({ ok: false, code: "facebook_page_mismatch" });
    expect((await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId: otherOrganizationId } })).facebookPageId).toBe("987654321");
  });

  it("keeps Page connections unique across organizations", async () => {
    await expect(prisma.organizationSettings.update({ where: { organizationId: otherOrganizationId }, data: { facebookPageId: PAGE_ID } })).rejects.toMatchObject({ code: "P2002" });
  });

  it("disconnects only the active organization, preserving imported leads", async () => {
    authorize(otherOrganizationId);
    expect((await disconnectFacebookPageAction()).ok).toBe(true);
    const settings = await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId: otherOrganizationId } });
    expect(settings).toMatchObject({ facebookPageId: null, facebookPageAccessToken: null });
    expect(await prisma.lead.count({ where: { organizationId: otherOrganizationId } })).toBe(1);
    expect((await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId } })).facebookPageId).toBe(PAGE_ID);
    expect((await syncFacebookLeadsAction())).toMatchObject({ ok: false, code: "facebook_not_connected" });
  });
});
