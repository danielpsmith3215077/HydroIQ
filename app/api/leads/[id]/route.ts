import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { withDb } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return await withDb(async (db) => {
      const lead = await db.lead.findFirst({
        where: { id: params.id, organizationId: session.orgId },
      });
      if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const body = (await req.json()) as { action: string; subject?: string; body?: string };

      if (body.action === "save_draft") {
        await db.lead.update({
          where: { id: lead.id },
          data: { emailSubject: body.subject ?? lead.emailSubject, emailBody: body.body ?? lead.emailBody },
        });
        await db.auditLog.create({
          data: { organizationId: session.orgId, leadId: lead.id, action: "Saved email draft" },
        });
      }

      if (body.action === "mark_sent") {
        await db.lead.update({
          where: { id: lead.id },
          data: {
            emailSubject: body.subject ?? lead.emailSubject,
            emailBody: body.body ?? lead.emailBody,
            status: "contacted",
            emailSentAt: new Date(),
            unread: false,
          },
        });
        await db.auditLog.create({
          data: { organizationId: session.orgId, leadId: lead.id, action: "Marked outreach sent" },
        });
      }

      return NextResponse.json({ ok: true });
    });
  } catch (err) {
    console.error("[leads] POST failed", err);
    return NextResponse.json({ error: "Database briefly unavailable" }, { status: 503 });
  }
}
