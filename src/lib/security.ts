import { createHash, timingSafeEqual } from "node:crypto";
import { AppError } from "./errors";

export function constantTimeEqual(left: string, right: string): boolean {
  return timingSafeEqual(createHash("sha256").update(left).digest(), createHash("sha256").update(right).digest());
}

export function safeLocalRedirect(value: string, appUrl: string): string {
  const origin = new URL(appUrl).origin;
  try {
    const target = new URL(value, origin);
    if (target.origin === origin && ["http:", "https:"].includes(target.protocol)) return target.toString();
  } catch { /* Invalid destinations fall back to the workspace. */ }
  return `${origin}/dashboard`;
}

/** Enforce the actual byte limit, including chunked requests without Content-Length. */
export async function readBoundedBody(body: ReadableStream<Uint8Array> | null, limit: number): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new AppError("Request is too large.", { code: "payload_too_large", status: 413 });
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    reader.releaseLock();
  }
}

export function contentSecurityPolicy(nonce: string, development: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // Radix, charts and progress bars use inline styles; scripts still require a nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    `connect-src 'self'${development ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
