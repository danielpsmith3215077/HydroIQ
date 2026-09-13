import { PrismaClient } from "@prisma/client";

/**
 * Vercel (and some CI) often cannot open Supabase direct db.*:5432.
 * Rewrite to the Supabase pooler (us-west-2) which is reachable over :6543.
 */
export function resolveDatabaseUrl(raw = process.env.DATABASE_URL ?? ""): string {
  if (!raw) return raw;
  try {
    const normalized = raw.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:");
    const u = new URL(normalized);
    const host = u.hostname;
    const direct = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(host);
    if (!direct) return raw;
    const ref = direct[1];
    const password = decodeURIComponent(u.password || "");
    if (!password) return raw;
    const user = `postgres.${ref}`;
    return `postgresql://${user}:${encodeURIComponent(password)}@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require`;
  } catch {
    return raw;
  }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makeClient() {
  const url = resolveDatabaseUrl();
  if (url && url !== process.env.DATABASE_URL) {
    process.env.DATABASE_URL = url;
  }
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
