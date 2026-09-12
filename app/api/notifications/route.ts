import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const notifications = await prisma.notification.findMany({
    where: { organizationId: session.orgId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  return NextResponse.json({ notifications });
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.notification.updateMany({
    where: { organizationId: session.orgId, readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
