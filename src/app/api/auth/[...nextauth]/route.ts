import { handlers } from "@/lib/auth";
import { NextRequest } from "next/server";
import { readBoundedBody } from "@/lib/security";
import { AppError } from "@/lib/errors";

export const { GET } = handlers;

export async function POST(request: NextRequest) {
  let body: Buffer;
  try { body = await readBoundedBody(request.body, 32 * 1024); }
  catch (error) { return new Response("Invalid request body.", { status: error instanceof AppError ? error.status : 400 }); }
  return handlers.POST(new NextRequest(request.url, { method: "POST", headers: request.headers, body: body.toString("utf8") }));
}
