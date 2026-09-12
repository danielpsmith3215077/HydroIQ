import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL ?? "";
const isPostgres = url.startsWith("postgres://") || url.startsWith("postgresql://");

if (isPostgres) {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
} else {
  execSync("npx prisma db push", { stdio: "inherit" });
}
