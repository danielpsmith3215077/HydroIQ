import { ensureAdmin } from "../lib/auth";
import { fetchEchoSdwa } from "../lib/ingest/echo";
import { fetchSuperfund } from "../lib/ingest/superfund";
import { upsertLeads } from "../lib/ingest/upsert";
import { runAlgorithmA } from "../lib/ingest/forecast";
import { recordRun } from "../lib/alerts";

async function main() {
  const org = await ensureAdmin();
  const started = new Date();
  const sdwa = await fetchEchoSdwa();
  const s1 = await upsertLeads(org.id, sdwa);
  await recordRun({
    organizationId: org.id,
    source: "echo_sdwa",
    status: sdwa.length ? "success" : "empty",
    recordsFound: sdwa.length,
    recordsCreated: s1.created,
    startedAt: started,
  });
  const started2 = new Date();
  const sf = await fetchSuperfund();
  const s2 = await upsertLeads(org.id, sf);
  await recordRun({
    organizationId: org.id,
    source: "superfund",
    status: sf.length ? "success" : "empty",
    recordsFound: sf.length,
    recordsCreated: s2.created,
    startedAt: started2,
  });
  await runAlgorithmA(org.id);
  console.log({ sdwa: { found: sdwa.length, ...s1 }, superfund: { found: sf.length, ...s2 } });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
