import { withDb, prisma } from "../prisma";
import { alertMaintainer, recordRun } from "../alerts";
import { fetchEchoCwa, fetchEchoRcra, fetchEchoSdwa } from "./echo";
import { fetchSuperfund } from "./superfund";
import { fetchSamOpportunities, fetchUsaSpendingAwards, storeComparables } from "./contracts";
import { amlisLeads, seedPfasWatchlist, staticAmlisLeads } from "./watchlists";
import { fetchMnpca, fetchSrf, fetchTceq } from "./states";
import { upsertLeads } from "./upsert";
import { runAlgorithmA, runAlgorithmB, runAlgorithmC } from "./forecast";
import type { DraftLead } from "../types";

type SourceFn = () => Promise<DraftLead[]>;

export type IngestMode = "bootstrap" | "full";

const LOCK_SOURCE = "_ingest";
const LOCK_TTL_MS = 4 * 60 * 1000;

async function tryAcquireIngestLock(organizationId: string): Promise<{ id: string } | "busy"> {
  const cutoff = new Date(Date.now() - LOCK_TTL_MS);
  await prisma.sourceRun.updateMany({
    where: {
      organizationId,
      source: LOCK_SOURCE,
      status: "running",
      finishedAt: null,
      startedAt: { lt: cutoff },
    },
    data: { status: "error", finishedAt: new Date(), error: "stale ingest lock released" },
  });

  const active = await prisma.sourceRun.findFirst({
    where: {
      organizationId,
      source: LOCK_SOURCE,
      status: "running",
      finishedAt: null,
      startedAt: { gt: cutoff },
    },
  });
  if (active) return "busy";

  const lock = await prisma.sourceRun.create({
    data: {
      organizationId,
      source: LOCK_SOURCE,
      status: "running",
      recordsFound: 0,
      recordsCreated: 0,
      startedAt: new Date(),
    },
  });
  return lock;
}

async function releaseIngestLock(lockId: string, ok: boolean, detail?: string) {
  await prisma.sourceRun
    .update({
      where: { id: lockId },
      data: {
        status: ok ? "success" : "error",
        finishedAt: new Date(),
        error: detail ?? null,
      },
    })
    .catch(() => undefined);
}

async function runSource(
  organizationId: string,
  source: string,
  fn: SourceFn,
  opts: { allowEmpty?: boolean } = {},
) {
  const startedAt = new Date();
  try {
    const drafts = await fn();
    if (!drafts.length) {
      await recordRun({
        organizationId,
        source,
        status: "empty",
        recordsFound: 0,
        recordsCreated: 0,
        error: "No rows returned",
        startedAt,
      });
      if (!opts.allowEmpty) {
        await alertMaintainer(source, "Ingestion returned no data when this source normally has records.");
      }
      return { source, found: 0, created: 0, updated: 0 };
    }
    const { created, updated } = await upsertLeads(organizationId, drafts);
    await recordRun({
      organizationId,
      source,
      status: "success",
      recordsFound: drafts.length,
      recordsCreated: created,
      startedAt,
    });
    return { source, found: drafts.length, created, updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordRun({
      organizationId,
      source,
      status: "error",
      recordsFound: 0,
      recordsCreated: 0,
      error: message,
      startedAt,
    });
    await alertMaintainer(source, message);
    return { source, found: 0, created: 0, updated: 0, error: message };
  }
}

/** Fast first-pull: local lists + TX/MN ECHO so the feed fills inside a Vercel budget. */
async function runBootstrapIngestion(organizationId: string) {
  const results = [];
  const fast = { quiet: true, createOnly: true } as const;

  {
    const startedAt = new Date();
    try {
      const drafts = await staticAmlisLeads();
      const r = await upsertLeads(organizationId, drafts, fast);
      await recordRun({
        organizationId,
        source: "e_amlis",
        status: "success",
        recordsFound: drafts.length,
        recordsCreated: r.created,
        startedAt,
      });
      results.push({ source: "e_amlis", found: drafts.length, created: r.created, updated: r.updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await recordRun({
        organizationId,
        source: "e_amlis",
        status: "error",
        recordsFound: 0,
        recordsCreated: 0,
        error: message,
        startedAt,
      });
      results.push({ source: "e_amlis", found: 0, created: 0, updated: 0, error: message });
    }
  }

  {
    const startedAt = new Date();
    try {
      const drafts = await fetchEchoCwa({
        states: ["TX", "MN"],
        concurrency: 2,
        timeoutMs: 20000,
        maxPages: 1,
        includePenalties: false,
      });
      if (!drafts.length) throw new Error("No bootstrap CWA rows");
      const r = await upsertLeads(organizationId, drafts, fast);
      await recordRun({
        organizationId,
        source: "echo_cwa",
        status: "success",
        recordsFound: drafts.length,
        recordsCreated: r.created,
        startedAt,
      });
      results.push({ source: "echo_cwa", found: drafts.length, created: r.created, updated: r.updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await recordRun({
        organizationId,
        source: "echo_cwa",
        status: "error",
        recordsFound: 0,
        recordsCreated: 0,
        error: message,
        startedAt,
      });
      results.push({ source: "echo_cwa", found: 0, created: 0, updated: 0, error: message });
    }
  }

  return results;
}

async function runFullIngestion(organizationId: string) {
  await seedPfasWatchlist(organizationId);

  const results = [];
  results.push(await runSource(organizationId, "echo_cwa", () => fetchEchoCwa()));
  results.push(await runSource(organizationId, "echo_sdwa", () => fetchEchoSdwa()));
  results.push(await runSource(organizationId, "echo_rcra", fetchEchoRcra, { allowEmpty: true }));
  results.push(await runSource(organizationId, "superfund", fetchSuperfund, { allowEmpty: true }));
  results.push(
    await runSource(organizationId, "sam_gov", async () => {
      const opps = await fetchSamOpportunities();
      const { leads, comparables } = await fetchUsaSpendingAwards();
      await storeComparables(organizationId, comparables);
      const merged = [...opps, ...leads];
      if (!merged.length) throw new Error("SAM.gov and USAspending both returned no matching awards/opportunities");
      return merged;
    }),
  );
  results.push(await runSource(organizationId, "e_amlis", async () => amlisLeads()));
  results.push(await runSource(organizationId, "tceq", fetchTceq, { allowEmpty: true }));
  results.push(await runSource(organizationId, "srf", fetchSrf, { allowEmpty: true }));
  results.push(await runSource(organizationId, "mpca", fetchMnpca, { allowEmpty: true }));

  const startedAt = new Date();
  try {
    const a = await runAlgorithmA(organizationId);
    const b = await runAlgorithmB(organizationId);
    const c = await runAlgorithmC(organizationId);
    await recordRun({
      organizationId,
      source: "forecast",
      status: "success",
      recordsFound: a + b.created + c.created,
      recordsCreated: b.created + c.created,
      startedAt,
    });
    results.push({
      source: "forecast",
      found: a,
      created: b.created + c.created,
      updated: b.updated + c.updated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertMaintainer("forecast", message);
    results.push({ source: "forecast", found: 0, created: 0, updated: 0, error: message });
  }

  return results;
}

export async function runIngestion(organizationId: string, mode: IngestMode = "full") {
  const lock = await tryAcquireIngestLock(organizationId);
  if (lock === "busy") {
    return [{ source: LOCK_SOURCE, found: 0, created: 0, updated: 0, error: "Ingest already running" }];
  }

  try {
    const results = mode === "bootstrap" ? await runBootstrapIngestion(organizationId) : await runFullIngestion(organizationId);
    const created = results.reduce((n, r) => n + (r.created ?? 0), 0);
    await releaseIngestLock(lock.id, true, `${mode}: ${created} created`);
    return results;
  } catch (err) {
    await releaseIngestLock(lock.id, false, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export async function latestSourceHealth(organizationId: string) {
  const runs = await withDb((db) =>
    db.sourceRun.findMany({
      where: { organizationId, source: { not: LOCK_SOURCE } },
      orderBy: { startedAt: "desc" },
      take: 40,
    }),
  );
  const bySource = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    if (!bySource.has(run.source)) bySource.set(run.source, run);
  }
  return Array.from(bySource.values());
}
