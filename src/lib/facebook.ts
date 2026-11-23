import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AppError } from "./errors";

export const facebookId = z.string().regex(/^\d+$/, "Enter a numeric Facebook ID.");
export const facebookLeadSchema = z.object({
  id: facebookId,
  created_time: z.string().optional(),
  form_id: facebookId.optional(),
  ad_id: facebookId.optional(),
  field_data: z.array(z.object({ name: z.string(), values: z.array(z.string()) })),
});
export type FacebookLead = z.infer<typeof facebookLeadSchema>;
const formSchema = z.object({ id: facebookId, name: z.string() });
export const FACEBOOK_LEAD_FIELDS = "id,created_time,form_id,ad_id,field_data";

export function missingFacebookConfiguration(): string[] {
  return ["FACEBOOK_APP_SECRET", "FACEBOOK_WEBHOOK_VERIFY_TOKEN", "FACEBOOK_TOKEN_ENCRYPTION_KEY"]
    .filter((name) => !process.env[name]?.trim());
}

function encryptionKey(): Buffer {
  const key = process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY?.trim() ?? "";
  if (!/^[a-f\d]{64}$/i.test(key)) {
    throw new AppError("Configure FACEBOOK_TOKEN_ENCRYPTION_KEY with a 32-byte hex key on the server.", { code: "facebook_configuration", status: 503 });
  }
  return Buffer.from(key, "hex");
}

export function encryptFacebookToken(token: string, organizationId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(organizationId));
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptFacebookToken(value: string, organizationId: string): string {
  try {
    const [version, iv, tag, encrypted] = value.split(":");
    if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Invalid ciphertext");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
    decipher.setAAD(Buffer.from(organizationId));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new AppError("Facebook credentials could not be decrypted. Check the server encryption key or reconnect the Page.", { code: "facebook_credentials", status: 503 });
  }
}

export function verifyFacebookSignature(body: string, signature: string | null, secret: string): boolean {
  if (!secret || !signature || !/^sha256=[a-f\d]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}

/** Never forwards Graph error messages, URLs, or access tokens to the browser/logs. */
export async function facebookRequest<T>(
  path: string,
  token: string,
  schema: z.ZodType<T>,
  parameters: Record<string, string> = {},
  method: "GET" | "POST" = "GET",
): Promise<T> {
  const version = process.env.FACEBOOK_GRAPH_API_VERSION?.trim() || "v27.0";
  if (!/^v\d+\.\d+$/.test(version)) throw new AppError("Invalid FACEBOOK_GRAPH_API_VERSION.", { code: "facebook_configuration" });
  const secret = process.env.FACEBOOK_APP_SECRET?.trim();
  if (!secret) throw new AppError("Configure FACEBOOK_APP_SECRET on the server.", { code: "facebook_configuration", status: 503 });
  const url = new URL(`https://graph.facebook.com/${version}/${path}`);
  url.search = new URLSearchParams({ ...parameters, appsecret_proof: createHmac("sha256", secret).update(token).digest("hex") }).toString();
  let response: Response;
  let payload: unknown;
  try {
    response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    payload = await response.json();
  } catch {
    throw new AppError("Facebook could not be reached. Try again shortly.", { code: "facebook_unavailable", status: 502 });
  }
  const graphError = z.object({ error: z.object({ code: z.number().optional() }) }).safeParse(payload);
  if (!response.ok || graphError.success) {
    const code = graphError.success ? graphError.data.error.code : undefined;
    throw new AppError(
      code === 190
        ? "The Facebook Page token expired or was revoked. Reconnect the Page in Settings."
        : "Facebook refused this request. Check the Page token, leads access and app permissions, then try again.",
      { code: code === 190 ? "facebook_token_expired" : "facebook_api_error", status: 502 },
    );
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new AppError("Facebook returned an unexpected response. Please try again.", { code: "facebook_response", status: 502 });
  return parsed.data;
}

/** Follows opaque cursors on our fixed Graph host, never arbitrary paging.next URLs. */
export async function* facebookPages<T>(path: string, token: string, item: z.ZodType<T>, fields: string): AsyncGenerator<T[]> {
  const schema = z.object({
    data: z.array(item),
    paging: z.object({ next: z.string().optional(), cursors: z.object({ after: z.string().optional() }).optional() }).optional(),
  });
  const seen = new Set<string>();
  let after: string | undefined;
  do {
    const page = await facebookRequest(path, token, schema, { fields, limit: "100", ...(after ? { after } : {}) });
    yield page.data;
    if (!page.paging?.next) return;
    after = page.paging.cursors?.after;
    if (!after || seen.has(after)) throw new AppError("Facebook pagination could not be completed. Retry the sync; imported leads will not be duplicated.", { code: "facebook_pagination", status: 502 });
    seen.add(after);
  } while (after);
}

export function facebookForms(pageId: string, token: string) {
  return facebookPages(`${facebookId.parse(pageId)}/leadgen_forms`, token, formSchema, "id,name");
}
