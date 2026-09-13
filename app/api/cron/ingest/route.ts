import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/auth";
import { withDb } from "@/lib/prisma";
import { runIngestion } from "@/lib/ingest/run";
import { ORG_SLUG } from "@/lib/constants";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await ensureAdmin();
    const org = await withDb((db) => db.organization.findUnique({ where: { slug: ORG_SLUG } }));
    if (!org) return NextResponse.json({ error: "Org missing" }, { status: 500 });
    const results = await runIngestion(org.id);
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[cron/ingest] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingest failed" },
      { status: 503 },
    );
  }
}
