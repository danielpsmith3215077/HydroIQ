import { withDb } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeadCard } from "@/components/lead-card";
import { DbUnavailable } from "@/components/db-unavailable";
import type { Lead } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ForecastsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let leads: Lead[] = [];
  let dbError = false;
  try {
    leads = await withDb((db) =>
      db.lead.findMany({
        where: {
          organizationId: session.orgId,
          OR: [{ variant: { in: ["predictive", "subcontract"] } }, { forecastWindow: { not: null } }],
        },
        orderBy: [{ score: "desc" }, { detectedAt: "desc" }],
        take: 80,
      }),
    );
  } catch (err) {
    console.error("[forecasts] database unavailable", err);
    dbError = true;
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-800">3–9 month head start</p>
      <h1 className="font-serif text-4xl text-navy">Predictive procurement</h1>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <div className="rounded-2xl border border-navy/10 bg-white p-4">
          <h2 className="font-serif text-lg">A · Municipal compound spike</h2>
          <p className="mt-1 text-navy/65">Three or more consecutive periods of the same contaminant on an ECHO / SDWIS utility → mandatory upgrade 3–6 months before the RFP.</p>
        </div>
        <div className="rounded-2xl border border-navy/10 bg-white p-4">
          <h2 className="font-serif text-lg">B · Unfunded PFAS bases</h2>
          <p className="mt-1 text-navy/65">Military AFFF watchlist minus active filtration awards. Pitch the 53-foot trailer as emergency mitigation while MILCON waits.</p>
        </div>
        <div className="rounded-2xl border border-navy/10 bg-white p-4">
          <h2 className="font-serif text-lg">C · Prime sub-tier</h2>
          <p className="mt-1 text-navy/65">New BOS / Civil Engineering umbrellas won by AECOM, Jacobs, and peers, sitting on top of an ECHO water problem.</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4">
        {dbError ? (
          <DbUnavailable />
        ) : leads.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-navy/20 bg-white px-6 py-12 text-center text-navy/60">
            Forecasts appear after the first source pull. Algorithm A tags ECHO utilities; B flags unfunded PFAS bases; C maps primes onto compliance sites.
          </p>
        ) : (
          leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
        )}
      </div>
    </div>
  );
}
