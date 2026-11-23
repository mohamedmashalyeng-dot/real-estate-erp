import { revalidatePath } from "next/cache";
import { verifyFacebookSignature } from "@/lib/facebook";
import { facebookWebhookSchema, processFacebookWebhook } from "@/lib/facebook-webhook";
import { constantTimeEqual, readBoundedBody } from "@/lib/security";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const expected = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN?.trim();
  if (!expected) return new Response("Facebook webhook is not configured.", { status: 503 });
  if (params.get("hub.mode") !== "subscribe" || !constantTimeEqual(params.get("hub.verify_token") ?? "", expected) || !params.get("hub.challenge") || params.get("hub.challenge")!.length > 256) {
    return new Response("Verification failed.", { status: 403 });
  }
  return new Response(params.get("hub.challenge"), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const secret = process.env.FACEBOOK_APP_SECRET?.trim();
  if (!secret) return new Response("Facebook webhook is not configured.", { status: 503 });
  const signature = request.headers.get("x-hub-signature-256");
  if (!signature || !/^sha256=[a-f\d]{64}$/i.test(signature)) return new Response("Invalid signature.", { status: 403 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return new Response("Expected JSON.", { status: 415 });
  let body: Buffer;
  try {
    body = await readBoundedBody(request.body, 256 * 1024);
  } catch (error) {
    return new Response("Invalid request body.", { status: error instanceof AppError ? error.status : 400 });
  }
  if (!verifyFacebookSignature(body, signature, secret)) {
    return new Response("Invalid signature.", { status: 403 });
  }
  let parsed;
  try {
    parsed = facebookWebhookSchema.safeParse(JSON.parse(body.toString("utf8")));
  } catch {
    return new Response("Invalid JSON.", { status: 400 });
  }
  if (!parsed.success) return new Response("Invalid payload.", { status: 400 });
  try {
    // Acknowledge only after committing: Facebook retries failures, while the
    // externalRef unique key prevents duplicate leads and timeline entries.
    await processFacebookWebhook(parsed.data);
    revalidatePath("/crm/leads");
    revalidatePath("/dashboard");
    revalidatePath("/settings");
    return Response.json({ received: true });
  } catch {
    console.error("[facebook-webhook] Lead import failed; awaiting delivery retry.");
    return new Response("Lead import failed. Please retry.", { status: 500 });
  }
}
