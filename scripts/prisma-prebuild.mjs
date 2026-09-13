import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL ?? "";
const isPostgres = url.startsWith("postgres://") || url.startsWith("postgresql://");

if (isPostgres) {
  console.log("[hydroiq] Running prisma migrate deploy…");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
} else {
  console.warn("[hydroiq] DATABASE_URL is not Postgres — skipping migrate deploy.");
}
