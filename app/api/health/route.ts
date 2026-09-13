import { NextResponse } from "next/server";
import { withDb } from "@/lib/prisma";
import { resolveDatabaseUrls } from "@/lib/db-url";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const resolved = resolveDatabaseUrls();
  try {
    const stats = await withDb(async (db) => {
      await db.$queryRaw`SELECT 1`;
      const [leads, users] = await Promise.all([db.lead.count(), db.user.count()]);
      return { leads, users };
    });
    return NextResponse.json({
      ok: true,
      host: resolved.host,
      rewritten: resolved.rewritten,
      ...stats,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        host: resolved.host,
        rewritten: resolved.rewritten,
        error: err instanceof Error ? err.message.slice(0, 200) : "db error",
      },
      { status: 503 },
    );
  }
}
