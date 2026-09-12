import Link from "next/link";
import { VariantBadge, SourceBadge } from "./lead-badge";
import { formatDate, formatMoney, locationLine } from "@/lib/utils";
import type { Lead } from "@prisma/client";

export function LeadCard({ lead }: { lead: Lead }) {
  const extraBadges = (JSON.parse(lead.badgesJson || "[]") as string[]).filter((b) => b !== lead.variant);
  return (
    <Link
      href={`/leads/${lead.id}`}
      className="block rounded-2xl border border-navy/10 bg-white p-4 shadow-sm transition hover:border-teal-700/40 hover:shadow-md md:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <VariantBadge variant={lead.variant} />
        {extraBadges.map((b) => (
          <VariantBadge key={b} variant={b} />
        ))}
        <SourceBadge source={lead.source} />
        {lead.status === "contacted" ? (
          <span className="rounded-full bg-navy/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-navy/60">
            Contacted
          </span>
        ) : null}
      </div>
      <h3 className="mt-3 font-serif text-xl text-navy md:text-2xl">{lead.facilityName}</h3>
      <p className="mt-1 text-sm font-medium text-navy/60">{locationLine(lead)}</p>
      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-navy/80">{lead.summary}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold uppercase tracking-wider text-navy/50">
        <span>Detected {formatDate(lead.detectedAt)}</span>
        {lead.fineAmount ? <span>Fine {formatMoney(lead.fineAmount)}</span> : null}
        {lead.estimatedValue ? <span>Value {formatMoney(lead.estimatedValue)}</span> : null}
        {lead.contaminantClass ? <span>{lead.contaminantClass}</span> : null}
        {lead.forecastWindow ? <span>Window {lead.forecastWindow}</span> : null}
      </div>
    </Link>
  );
}
