import { NextResponse } from "next/server";
import { ensureAdmin, getSession } from "@/lib/auth";
import { runIngestion } from "@/lib/ingest/run";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureAdmin();
    const results = await runIngestion(session.orgId);
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[ingest] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingest failed" },
      { status: 503 },
    );
  }
}
