import { withDb } from "../prisma";
import { alertMaintainer, recordRun } from "../alerts";
import { fetchEchoCwa, fetchEchoRcra, fetchEchoSdwa } from "./echo";
import { fetchSuperfund } from "./superfund";
import { fetchSamOpportunities, fetchUsaSpendingAwards, storeComparables } from "./contracts";
import { amlisLeads, seedPfasWatchlist } from "./watchlists";
import { fetchMnpca, fetchSrf, fetchTceq } from "./states";
import { upsertLeads } from "./upsert";
import { runAlgorithmA, runAlgorithmB, runAlgorithmC } from "./forecast";
import type { DraftLead } from "../types";

type SourceFn = () => Promise<DraftLead[]>;

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

export async function runIngestion(organizationId: string) {
  await seedPfasWatchlist(organizationId);

  const results = [];
  results.push(await runSource(organizationId, "echo_cwa", fetchEchoCwa));
  results.push(await runSource(organizationId, "echo_sdwa", fetchEchoSdwa));
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

export async function latestSourceHealth(organizationId: string) {
  const runs = await withDb((db) =>
    db.sourceRun.findMany({
      where: { organizationId },
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
