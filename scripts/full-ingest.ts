import { ensureAdmin } from "../lib/auth";
import { runIngestion } from "../lib/ingest/run";

async function main() {
  const org = await ensureAdmin();
  const results = await runIngestion(org.id);
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
