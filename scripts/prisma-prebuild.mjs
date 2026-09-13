import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL ?? "";
const isPostgres = url.startsWith("postgres://");

console.warn("[hydroiq] Skipping prisma migrate deploy — tables already created manually in Supabase.");