import { revalidatePath } from "next/cache";
import { verifyFacebookSignature } from "@/lib/facebook";
import { facebookWebhookSchema, processFacebookWebhook } from "@/lib/facebook-webhook";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const expected = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN?.trim();
  if (!expected) return new Response("Facebook webhook is not configured.", { status: 503 });
  if (params.get("hub.mode") !== "subscribe" || params.get("hub.verify_token") !== expected || !params.get("hub.challenge")) {
    return new Response("Verification failed.", { status: 403 });
  }
  return new Response(params.get("hub.challenge"), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const secret = process.env.FACEBOOK_APP_SECRET?.trim();
  if (!secret) return new Response("Facebook webhook is not configured.", { status: 503 });
  const body = await request.text();
  if (!verifyFacebookSignature(body, request.headers.get("x-hub-signature-256"), secret)) {
    return new Response("Invalid signature.", { status: 403 });
  }
  let parsed;
  try {
    parsed = facebookWebhookSchema.safeParse(JSON.parse(body));
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
