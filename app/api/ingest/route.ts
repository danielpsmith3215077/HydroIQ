import { NextResponse } from "next/server";
import { ensureAdmin, getSession } from "@/lib/auth";
import { runIngestion, type IngestMode } from "@/lib/ingest/run";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function parseMode(req: Request): IngestMode {
  const url = new URL(req.url);
  const q = url.searchParams.get("mode");
  if (q === "bootstrap" || q === "full") return q;
  return "full";
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const mode = parseMode(req);
  try {
    await ensureAdmin();
    const results = await runIngestion(session.orgId, mode);
    const busy = results.some((r) => r.source === "_ingest" && r.error === "Ingest already running");
    return NextResponse.json({ ok: true, mode, busy, results });
  } catch (err) {
    console.error("[ingest] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingest failed" },
      { status: 503 },
    );
  }
}
