const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split(/\n/)
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);

const direct = env.DATABASE_URL;
const u = new URL(direct.replace(/^postgresql:/, "http:").replace(/^postgres:/, "http:"));
const pass = decodeURIComponent(u.password);
const ref = u.hostname.replace(/^db\./, "").replace(/\.supabase\.co$/, "");

const candidates = [
  `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require`,
  `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require`,
  `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require`,
  `postgresql://postgres:${encodeURIComponent(pass)}@db.${ref}.supabase.co:5432/postgres?sslmode=require`,
];

async function tryUrl(url, label) {
  const host = new URL(url.replace(/^postgresql:/, "http:")).host;
  process.env.DATABASE_URL = url;
  const p = new PrismaClient();
  try {
    await Promise.race([
      p.$queryRaw`SELECT 1 as ok`,
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
    ]);
    const tables = await p.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename
    `;
    console.log("OK", label, host, "tables:", tables.map((t) => t.tablename).join(","));
    await p.$disconnect();
    return url;
  } catch (e) {
    console.log("FAIL", label, host, String(e.message).slice(0, 120));
    await p.$disconnect().catch(() => {});
    return null;
  }
}

(async () => {
  console.log("ref", ref);
  for (const [i, url] of candidates.entries()) {
    const ok = await tryUrl(url, `c${i}`);
    if (ok) {
      fs.writeFileSync("/tmp/working-database-url.txt", ok);
      process.exit(0);
    }
  }
  process.exit(1);
})();
