import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const lead = await prisma.lead.findFirst({
    where: { id: params.id, organizationId: session.orgId },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json()) as { action: string; subject?: string; body?: string };

  if (body.action === "save_draft") {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { emailSubject: body.subject ?? lead.emailSubject, emailBody: body.body ?? lead.emailBody },
    });
    await prisma.auditLog.create({
      data: { organizationId: session.orgId, leadId: lead.id, action: "Saved email draft" },
    });
  }

  if (body.action === "mark_sent") {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        emailSubject: body.subject ?? lead.emailSubject,
        emailBody: body.body ?? lead.emailBody,
        status: "contacted",
        emailSentAt: new Date(),
        unread: false,
      },
    });
    await prisma.auditLog.create({
      data: { organizationId: session.orgId, leadId: lead.id, action: "Marked outreach sent" },
    });
  }

  return NextResponse.json({ ok: true });
}
