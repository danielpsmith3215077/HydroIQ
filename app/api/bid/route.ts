import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { suggestBidRange } from "@/lib/bid";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as {
    flowGpd?: number;
    durationDays?: number;
    contaminant?: string;
    proposedBid?: number;
  };
  const result = await suggestBidRange(session.orgId, body);
  return NextResponse.json(result);
}
