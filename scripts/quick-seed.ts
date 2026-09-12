import { ensureAdmin } from "../lib/auth";
import { amlisLeads, seedPfasWatchlist } from "../lib/ingest/watchlists";
import { upsertLeads } from "../lib/ingest/upsert";
import { runAlgorithmB } from "../lib/ingest/forecast";

async function main() {
  const org = await ensureAdmin();
  await seedPfasWatchlist(org.id);
  const amlis = await upsertLeads(org.id, await amlisLeads());
  const pfas = await runAlgorithmB(org.id);
  console.log(JSON.stringify({ org: org.slug, amlis, pfas }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
