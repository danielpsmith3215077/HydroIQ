import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrls } from "./db-url";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaUrl?: string;
};

function makeClient(url: string) {
  return new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function activeClient(): PrismaClient {
  const { primary, fallbacks } = resolveDatabaseUrls();
  const url = primary || process.env.DATABASE_URL || "";
  if (!url) return globalForPrisma.prisma ?? makeClient("");

  if (globalForPrisma.prisma && globalForPrisma.prismaUrl === url) {
    return globalForPrisma.prisma;
  }

  if (globalForPrisma.prisma) {
    void globalForPrisma.prisma.$disconnect().catch(() => undefined);
  }

  // Prefer mutating env so any nested Prisma usage sees the pooler URL too.
  process.env.DATABASE_URL = url;
  if (fallbacks[0]) process.env.DATABASE_URL_SESSION = fallbacks[0];

  const client = makeClient(url);
  globalForPrisma.prisma = client;
  globalForPrisma.prismaUrl = url;
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = activeClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/** Run a DB operation with one reconnect + session-pooler fallback. */
export async function withDb<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T> {
  const { primary, fallbacks } = resolveDatabaseUrls();
  const urls = [primary, ...fallbacks].filter(Boolean);
  let lastErr: unknown;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!;
    try {
      if (globalForPrisma.prismaUrl !== url) {
        if (globalForPrisma.prisma) {
          await globalForPrisma.prisma.$disconnect().catch(() => undefined);
        }
        process.env.DATABASE_URL = url;
        globalForPrisma.prisma = makeClient(url);
        globalForPrisma.prismaUrl = url;
      }
      const db = globalForPrisma.prisma!;
      await db.$connect();
      return await fn(db);
    } catch (err) {
      lastErr = err;
      if (globalForPrisma.prisma) {
        await globalForPrisma.prisma.$disconnect().catch(() => undefined);
        globalForPrisma.prisma = undefined;
        globalForPrisma.prismaUrl = undefined;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Database unavailable");
}
