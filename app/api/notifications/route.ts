import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { withDb } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const notifications = await withDb((db) =>
      db.notification.findMany({
        where: { organizationId: session.orgId },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
    );
    return NextResponse.json({ notifications });
  } catch (err) {
    console.error("[notifications] GET failed", err);
    return NextResponse.json({ notifications: [], degraded: true });
  }
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await withDb((db) =>
      db.notification.updateMany({
        where: { organizationId: session.orgId, readAt: null },
        data: { readAt: new Date() },
      }),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notifications] POST failed", err);
    return NextResponse.json({ error: "Database briefly unavailable" }, { status: 503 });
  }
}
