import { withDb } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeadCard } from "@/components/lead-card";
import { RefreshSources } from "@/components/refresh-sources";
import { AutoIngest } from "@/components/auto-ingest";
import { DbUnavailable } from "@/components/db-unavailable";
import { latestSourceHealth } from "@/lib/ingest/run";
import { formatDate } from "@/lib/utils";
import type { Lead } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: { q?: string; source?: string; variant?: string; state?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const q = searchParams.q?.trim();

  let leads: Lead[] = [];
  let health: Awaited<ReturnType<typeof latestSourceHealth>> = [];
  let dbError = false;

  try {
    leads = await withDb((db) =>
      db.lead.findMany({
        where: {
          organizationId: session.orgId,
          status: { not: "contacted" },
          ...(searchParams.source ? { source: searchParams.source } : {}),
          ...(searchParams.variant ? { variant: searchParams.variant } : {}),
          ...(searchParams.state ? { state: searchParams.state.toUpperCase() } : {}),
          ...(q
            ? {
                OR: [
                  { facilityName: { contains: q } },
                  { city: { contains: q } },
                  { summary: { contains: q } },
                  { contaminantClass: { contains: q } },
                ],
              }
            : {}),
        },
        orderBy: [{ score: "desc" }, { detectedAt: "desc" }],
        take: 120,
      }),
    );
    health = await latestSourceHealth(session.orgId);
  } catch (err) {
    console.error("[feed] database unavailable", err);
    dbError = true;
  }

  const failed = health.filter((h) => h.status === "error" || h.status === "empty");
  const lastOk = health.find((h) => h.status === "success");

  return (
    <div>
      <AutoIngest empty={!dbError && leads.length === 0} />
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-800">AMFS internal</p>
          <h1 className="font-serif text-4xl text-navy md:text-5xl">Lead feed</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-navy/70">
            Real public records only — EPA ECHO (CWA, SDWIS, RCRA), Superfund, SAM.gov / USAspending, military PFAS watchlist, e-AMLIS, and Texas/Minnesota SRF portals. Newest and highest-signal first.
          </p>
        </div>
        <RefreshSources empty={!dbError && leads.length === 0} />
      </div>

      {failed.length && lastOk ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Showing last good pull from {formatDate(lastOk.finishedAt)}. A source is delayed; new leads will appear when it recovers. This is not an empty database.
        </div>
      ) : null}

      <form className="mt-6 grid gap-2 sm:grid-cols-4">
        <input
          name="q"
          defaultValue={searchParams.q}
          placeholder="Search facility, city, contaminant"
          className="h-11 rounded-md border border-navy/15 bg-white px-3 text-base sm:col-span-2"
        />
        <select name="variant" defaultValue={searchParams.variant ?? ""} className="h-11 rounded-md border border-navy/15 bg-white px-3">
          <option value="">All types</option>
          <option value="live_violation">Live violations</option>
          <option value="live_bid">Live bids</option>
          <option value="predictive">Predictive RFP</option>
          <option value="subcontract">Subcontracts</option>
        </select>
        <div className="flex gap-2">
          <input
            name="state"
            defaultValue={searchParams.state}
            placeholder="ST"
            maxLength={2}
            className="h-11 w-20 rounded-md border border-navy/15 bg-white px-3 uppercase"
          />
          <button className="h-11 flex-1 rounded-md bg-navy px-4 text-sm font-semibold text-white">Filter</button>
        </div>
      </form>

      {dbError ? (
        <DbUnavailable />
      ) : leads.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-navy/20 bg-white px-6 py-16 text-center">
          <h2 className="font-serif text-2xl text-navy">Waiting on the first public-records pull</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-navy/65">
            HydroIQ never invents leads. The first EPA ECHO sweep is running now. If this sits empty for more than a couple of minutes, tap{" "}
            <span className="font-semibold text-navy">Load live leads</span>.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  );
}
