/**
 * Vercel / serverless often cannot reach Supabase direct `db.*:5432` (P1001).
 * Always prefer the transaction pooler; fall back to session-mode pooler.
 */

export type ResolvedDbUrls = {
  primary: string;
  fallbacks: string[];
  host: string;
  rewritten: boolean;
};

function toHttpUrl(raw: string): URL {
  return new URL(raw.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:"));
}

function fromHttpUrl(u: URL): string {
  return `postgresql://${u.username}:${u.password}@${u.host}${u.pathname}${u.search}`;
}

function withParams(url: string, params: Record<string, string>): string {
  const u = toHttpUrl(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return fromHttpUrl(u);
}

function projectRefFromUrl(raw: string): string {
  try {
    const u = toHttpUrl(raw);
    const direct = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(u.hostname);
    if (direct) return direct[1];
    const poolerUser = /^postgres\.([a-z0-9]+)$/i.exec(decodeURIComponent(u.username));
    if (poolerUser) return poolerUser[1];
  } catch {
    /* ignore */
  }
  return (process.env.SUPABASE_PROJECT_REF ?? "").trim();
}

function poolerRegion(raw: string): string {
  try {
    const u = toHttpUrl(raw);
    const m = /^aws-\d+-([a-z0-9-]+)\.pooler\.supabase\.com$/i.exec(u.hostname);
    if (m) return m[1];
  } catch {
    /* ignore */
  }
  return (process.env.SUPABASE_POOLER_REGION ?? "us-west-2").trim() || "us-west-2";
}

/** Build transaction (6543) + session (5432) pooler URLs for a project. */
export function buildPoolerUrls(ref: string, password: string, region: string): string[] {
  const user = `postgres.${ref}`;
  const encoded = encodeURIComponent(password);
  const transaction = withParams(
    `postgresql://${user}:${encoded}@aws-0-${region}.pooler.supabase.com:6543/postgres`,
    { pgbouncer: "true", sslmode: "require", connection_limit: "1", connect_timeout: "15" },
  );
  const session = withParams(
    `postgresql://${user}:${encoded}@aws-0-${region}.pooler.supabase.com:5432/postgres`,
    { sslmode: "require", connection_limit: "1", connect_timeout: "15" },
  );
  return [transaction, session];
}

export function resolveDatabaseUrls(raw = process.env.DATABASE_URL ?? ""): ResolvedDbUrls {
  if (!raw) {
    return { primary: "", fallbacks: [], host: "missing", rewritten: false };
  }

  try {
    const u = toHttpUrl(raw);
    const password = decodeURIComponent(u.password || "");
    const ref = projectRefFromUrl(raw);
    const region = poolerRegion(raw);
    const originalHost = u.host;

    if (!password || !ref) {
      const ensured = withParams(raw, {
        sslmode: "require",
        connection_limit: "1",
        connect_timeout: "15",
        ...(u.port === "6543" || u.searchParams.get("pgbouncer") === "true"
          ? { pgbouncer: "true" }
          : {}),
      });
      return {
        primary: ensured,
        fallbacks: [],
        host: originalHost,
        rewritten: ensured !== raw,
      };
    }

    const [transaction, session] = buildPoolerUrls(ref, password, region);
    const rewritten =
      !originalHost.includes("pooler.supabase.com") ||
      decodeURIComponent(u.username) !== `postgres.${ref}` ||
      u.port === "5432" && !originalHost.includes("pooler");

    return {
      primary: transaction,
      fallbacks: [session],
      host: toHttpUrl(transaction).host,
      rewritten: rewritten || transaction !== raw,
    };
  } catch {
    return { primary: raw, fallbacks: [], host: "invalid", rewritten: false };
  }
}

/** Single URL for Prisma (transaction pooler preferred). */
export function resolveDatabaseUrl(raw = process.env.DATABASE_URL ?? ""): string {
  return resolveDatabaseUrls(raw).primary || raw;
}
