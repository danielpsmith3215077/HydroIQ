import { NextResponse } from "next/server";
import { alertMaintainer } from "@/lib/alerts";

export const dynamic = "force-dynamic";

/**
 * Maintainer-only: verifies Resend + MAINTAINER_EMAIL wiring.
 * GET /api/cron/test-alert with Authorization: Bearer $CRON_SECRET
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await alertMaintainer(
    "test-alert",
    "This is a deliberate HydroIQ maintainer alert test. If you received email, failure notifications are wired correctly.",
    "Triggered from /api/cron/test-alert",
  );
  return NextResponse.json({
    ok: true,
    maintainerEmail: process.env.MAINTAINER_EMAIL ? "set" : "missing",
    resend: process.env.RESEND_API_KEY ? "set" : "missing",
  });
}
