/**
 * Centralised, lazily-validated environment access.
 *
 * Nothing here throws at import time, so `next build` stays green even when a
 * deployment injects secrets at runtime only.
 */

export type AIProviderName = "mock" | "openai" | "anthropic" | "gemini";

function read(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") return undefined;
  return value;
}

export function requireEnv(name: string): string {
  const value = read(name);
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". Copy .env.example to .env and set it.`,
    );
  }
  return value;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = read(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  get databaseUrl(): string {
    return requireEnv("DATABASE_URL");
  },
  get authSecret(): string {
    return read("AUTH_SECRET") ?? "insecure-development-secret-do-not-use-in-production";
  },
  get appUrl(): string {
    return read("APP_URL") ?? "http://localhost:3000";
  },
  get sessionMaxAgeSeconds(): number {
    return intFromEnv("SESSION_MAX_AGE_SECONDS", 60 * 60 * 8);
  },
  get aiProvider(): AIProviderName {
    const raw = (read("AI_PROVIDER") ?? "mock").toLowerCase();
    if (raw === "openai" || raw === "anthropic" || raw === "gemini") return raw;
    return "mock";
  },
  get aiModel(): string | undefined {
    return read("AI_MODEL");
  },
  get openaiApiKey(): string | undefined {
    return read("OPENAI_API_KEY");
  },
  get anthropicApiKey(): string | undefined {
    return read("ANTHROPIC_API_KEY");
  },
  get geminiApiKey(): string | undefined {
    return read("GEMINI_API_KEY");
  },
  get seedDefaultPassword(): string {
    return read("SEED_DEFAULT_PASSWORD") ?? "Password123!";
  },
  get platformAdminEmail(): string {
    return read("PLATFORM_ADMIN_EMAIL") ?? "platform@estateiq.dev";
  },
  get isTest(): boolean {
    return process.env.NODE_ENV === "test";
  },
};
