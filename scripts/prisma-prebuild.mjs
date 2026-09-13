import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL ?? "";
const isPostgres = url.startsWith("postgres://") || url.startsWith("postgresql://");

// Vercel build network often cannot reach Supabase :5432 (P1001).
// Schema is applied via scripts/supabase-init.sql or GitHub Actions — do not fail the build.
if (isPostgres && process.env.PRISMA_MIGRATE_ON_BUILD === "1") {
  console.log("[hydroiq] PRISMA_MIGRATE_ON_BUILD=1 — running prisma migrate deploy…");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
} else {
  console.warn(
    "[hydroiq] Skipping prisma migrate deploy during build (set PRISMA_MIGRATE_ON_BUILD=1 to enable).",
  );
}
