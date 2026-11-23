import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { testDatabaseUrl } from "../scripts/lib/dev-db-config";
import { actionFailure, AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { contentSecurityPolicy, constantTimeEqual, readBoundedBody, safeLocalRedirect } from "@/lib/security";
import { scopeTenantArgs, TENANT_MODEL_SET } from "@/lib/tenant";

vi.mock("@/lib/context", () => ({ requireOrganization: vi.fn() }));

process.env.DATABASE_URL = testDatabaseUrl();
const { prisma, forOrganization } = await import("@/lib/prisma");
const { redactSensitive } = await import("@/lib/audit");
const { consumeLoginAttempt, authorizeCredentials, LOGIN_ATTEMPT_LIMIT } = await import("@/lib/login");
const suffix = Date.now().toString(36);
const emails = new Set<string>();
const email = (prefix: string) => { const value = `${prefix}-${suffix}@security.example.test`; emails.add(value); return value; };
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [...emails] } } });
  const keys = [...emails].map((value) => createHmac("sha256", env.authSecret).update(value.toLowerCase()).digest("hex"));
  await prisma.auditLog.deleteMany({ where: { organizationId: null, entityType: "LoginGuard", entityId: { in: keys } } });
  await prisma.$disconnect();
});

describe("request and browser security", () => {
  it("exports untrusted formulas as quoted text while preserving financial numbers", async () => {
    const { toCsv } = await import("@/lib/reports");
    for (const value of ["=1+2", "+SUM(A1)", "@SUM(A1)", "-1+2", "＝1+2", "\t=1+2"]) {
      expect(toCsv(["Name"], [[value]])).toContain(`"\t${value}"`);
    }
    expect(toCsv(["Amount"], [["-1234.50"], [-42]])).toContain("-1234.50\r\n-42");
  });
  it("restricts sign-in redirects to the configured site", () => {
    expect(safeLocalRedirect("/crm/leads", "https://erp.example.test")).toBe("https://erp.example.test/crm/leads");
    for (const value of ["https://untrusted.example/", "//untrusted.example/", "/\\untrusted.example/", "javascript:alert(1)"]) expect(safeLocalRedirect(value, "https://erp.example.test")).toBe("https://erp.example.test/dashboard");
  });
  it("rejects unsafe production auth secrets, with no known fallback", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => env.authSecret).toThrow("AUTH_SECRET");
    vi.stubEnv("AUTH_SECRET", "replace-me-with-a-32-byte-random-string");
    expect(() => env.authSecret).toThrow();
    vi.stubEnv("AUTH_SECRET", "a-unique-test-auth-secret-with-over-32-characters");
    expect(env.authSecret).toContain("a-unique-test");
  });
  it("does not disclose raw internal errors to clients or logs", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const secret = "private-connection-string-and-password";
    const result = actionFailure(new Error(secret));
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(spy.mock.calls)).not.toContain(secret);
    expect(actionFailure(new AppError("Select a Page.", { code: "validation_error" }))).toMatchObject({ error: "Select a Page." });
  });
  it("redacts camelCase secrets and credentials nested inside arrays", () => {
    const result = redactSensitive({ passwordHash: "sensitive", facebookPageAccessToken: "sensitive", entries: [{ apiKey: "sensitive", name: "kept" }, [{ AUTH_SECRET: "sensitive" }]], source: "facebook" });
    expect(JSON.stringify(result)).not.toContain("sensitive");
    expect(JSON.stringify(result)).toContain("kept");
    expect(result?.source).toBe("facebook");
  });
  it("bounds streamed bytes even without a Content-Length header", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(5)); controller.enqueue(new Uint8Array(5)); }, cancel() { cancelled = true; } });
    await expect(readBoundedBody(body, 8)).rejects.toMatchObject({ status: 413 });
    expect(cancelled).toBe(true);
    const small = new Response("hello").body;
    expect((await readBoundedBody(small, 8)).toString()).toBe("hello");
  });
  it("requires a nonce for production scripts and prevents framing and plugins", () => {
    const csp = contentSecurityPolicy("test-nonce", false);
    expect(csp).toContain("'nonce-test-nonce'");
    expect(csp.split(";").find((value) => value.includes("script-src"))).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(contentSecurityPolicy("test", true)).toContain("unsafe-eval");
    expect(constantTimeEqual("correct", "correct")).toBe(true);
    expect(constantTimeEqual("correct", "wrong")).toBe(false);
  });
});

describe("tenant updates", () => {
  it("does not query restricted dashboard metrics for a member without permissions", async () => {
    const { requireOrganization } = await import("@/lib/context");
    const { default: Dashboard } = await import("@/app/(dashboard)/dashboard/page");
    const restricted = vi.fn();
    vi.mocked(requireOrganization).mockResolvedValue({
      db: { lead: { groupBy: restricted, count: restricted }, unit: { groupBy: restricted }, sale: { aggregate: restricted }, reservation: { count: restricted }, followUp: { findMany: restricted }, installment: { findMany: restricted } },
      permissions: [], currency: "EGP", membership: { organizationName: "Test workspace" }, user: { name: "Test User" },
    } as unknown as Awaited<ReturnType<typeof requireOrganization>>);
    await Dashboard();
    expect(restricted).not.toHaveBeenCalled();
  });
  it("covers every model that carries organizationId", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    for (const model of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
      if (/^\s+organizationId\s/m.test(model[2])) expect(TENANT_MODEL_SET.has(model[1]), model[1]).toBe(true);
    }
  });
  it("blocks tenant reassignment in updates, upserts and nested organization writes", () => {
    for (const operation of ["update", "updateMany"]) {
      expect(() => scopeTenantArgs("Lead", operation, { data: { organizationId: "other" } }, "active")).toThrow();
      expect(() => scopeTenantArgs("Lead", operation, { data: { organizationId: { set: "other" } } }, "active")).toThrow();
      expect(() => scopeTenantArgs("Lead", operation, { data: { organization: { connect: { id: "other" } } } }, "active")).toThrow();
    }
    expect(() => scopeTenantArgs("Lead", "upsert", { create: {}, update: { organizationId: "other" } }, "active")).toThrow();
    expect(() => scopeTenantArgs("Lead", "create", { data: { organization: { create: { name: "other" } } } }, "active")).toThrow();
  });
  it("keeps existing rows isolated when a caller attempts to transfer ownership", async () => {
    const org = await prisma.organization.create({ data: { name: "Security tests", slug: `security-${suffix}` } });
    try {
      const lead = await forOrganization(org.id).lead.create({ data: { organizationId: org.id, firstName: "Test", lastName: "Record", phone: "" } });
      await expect(forOrganization(org.id).lead.update({ where: { id: lead.id }, data: { organizationId: "other" } })).rejects.toThrow();
      expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).organizationId).toBe(org.id);
    } finally { await prisma.organization.delete({ where: { id: org.id } }); }
  });
});

describe("durable sign-in throttling", () => {
  it("limits simultaneous attempts and permits attempts after the window expires", async () => {
    const account = email("parallel");
    const now = new Date();
    const outcomes = await Promise.all(Array.from({ length: 12 }, () => consumeLoginAttempt(account, now)));
    expect(outcomes.filter(Boolean)).toHaveLength(LOGIN_ATTEMPT_LIMIT);
    expect(await consumeLoginAttempt(account, new Date(now.getTime() + 16 * 60_000))).toBe(true);
  });
  it("normalizes account names and persists the limit independently of process state", async () => {
    const account = email("normalized");
    for (let index = 0; index < LOGIN_ATTEMPT_LIMIT; index++) expect(await consumeLoginAttempt(account.toUpperCase())).toBe(true);
    expect(await consumeLoginAttempt(` ${account} `)).toBe(false);
    const key = createHmac("sha256", env.authSecret).update(account).digest("hex");
    expect(await prisma.auditLog.count({ where: { organizationId: null, entityType: "LoginGuard", entityId: key } })).toBe(LOGIN_ATTEMPT_LIMIT);
  });
  it("rejects inactive users, handles unknown users, and never returns password hashes", async () => {
    const passwordHash = await bcrypt.hash("Only-a-local-test-password", 10);
    for (const status of ["ACTIVE", "INVITED", "SUSPENDED"] as const) {
      const account = email(status.toLowerCase());
      await prisma.user.create({ data: { email: account, name: status, passwordHash, status } });
      const result = await authorizeCredentials({ email: ` ${account.toUpperCase()} `, password: "Only-a-local-test-password" });
      if (status === "ACTIVE") { expect(result?.email).toBe(account); expect(JSON.stringify(result)).not.toContain(passwordHash); }
      else expect(result).toBeNull();
    }
    expect(await authorizeCredentials({ email: email("unknown"), password: "Only-a-local-test-password" })).toBeNull();
    expect(await authorizeCredentials({ email: "invalid", password: "x".repeat(500) })).toBeNull();
  });
});
