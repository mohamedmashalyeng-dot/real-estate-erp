import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma ORM v7 configuration.
 *
 * v7 no longer reads `.env` implicitly and no longer accepts `url` inside the
 * schema datasource block, so the connection string is wired up here.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need a direct connection; Neon's Vercel integration exposes
    // it as DATABASE_URL_UNPOOLED next to the pooled DATABASE_URL.
    url: process.env.DATABASE_URL_UNPOOLED || env("DATABASE_URL"),
  },
});
