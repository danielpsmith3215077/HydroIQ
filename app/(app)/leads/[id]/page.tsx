import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { EmailPanel } from "@/components/email-panel";
import { BidPanel } from "@/components/bid-panel";
import { SourceBadge, VariantBadge } from "@/components/lead-badge";
import { formatDate, formatMoney, locationLine } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeadPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const lead = await prisma.lead.findFirst({
    where: { id: params.id, organizationId: session.orgId },
    include: { auditLogs: { orderBy: { createdAt: "desc" }, take: 12 } },
  });
  if (!lead) notFound();
  const extra = (JSON.parse(lead.badgesJson || "[]") as string[]).filter((b) => b !== lead.variant);

  return (
    <div className="space-y-5">
      <a href="/" className="text-sm font-semibold text-teal-800">
        ← Lead feed
      </a>
      <div className="flex flex-wrap gap-2">
        <VariantBadge variant={lead.variant} />
        {extra.map((b) => (
          <VariantBadge key={b} variant={b} />
        ))}
        <SourceBadge source={lead.source} />
      </div>
      <h1 className="font-serif text-4xl text-navy">{lead.facilityName}</h1>
      <p className="text-navy/65">{locationLine(lead)}</p>
      {lead.address ? <p className="text-sm text-navy/55">{lead.address}{lead.zip ? ` ${lead.zip}` : ""}</p> : null}

      <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
        <p className="text-sm leading-relaxed text-navy/85">{lead.summary}</p>
        {lead.detail ? <p className="mt-3 text-sm text-navy/60">{lead.detail}</p> : null}
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-navy/45">Violation / contract</dt>
            <dd>{lead.violationType || lead.contractType || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-navy/45">Contaminant</dt>
            <dd>{lead.contaminantClass || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-navy/45">Fine / penalty</dt>
            <dd>{formatMoney(lead.fineAmount)}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-navy/45">Award / estimate</dt>
            <dd>{formatMoney(lead.estimatedValue)}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-navy/45">Detected</dt>
            <dd>{formatDate(lead.detectedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-navy/45">Event date</dt>
            <dd>{formatDate(lead.eventDate)}</dd>
          </div>
          {lead.forecastWindow ? (
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-navy/45">Forecast window</dt>
              <dd>{lead.forecastWindow}</dd>
            </div>
          ) : null}
          {lead.primeContractor ? (
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-navy/45">Prime</dt>
              <dd>{lead.primeContractor}</dd>
            </div>
          ) : null}
        </dl>
        <a
          href={lead.sourceRecordUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex min-h-11 items-center rounded-md bg-navy px-4 text-sm font-semibold text-white"
        >
          🔗 View Official Public Record
        </a>
      </div>

      <EmailPanel lead={lead} />

      {(lead.variant === "live_bid" || lead.variant === "subcontract" || lead.estimatedValue) && (
        <BidPanel leadId={lead.id} suggestedValue={lead.estimatedValue} />
      )}

      <section className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-xl text-navy">Audit log</h2>
        {lead.auditLogs.length === 0 ? (
          <p className="mt-2 text-sm text-navy/55">No outreach actions yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {lead.auditLogs.map((log) => (
              <li key={log.id} className="flex justify-between gap-3 border-b border-navy/5 py-2">
                <span className="font-medium">{log.action}</span>
                <span className="text-navy/50">{new Date(log.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
