import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SOURCE_LABELS } from "@/lib/constants";
import { latestSourceHealth } from "@/lib/ingest/run";
import { formatDate } from "@/lib/utils";
import { RefreshSources } from "@/components/refresh-sources";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const health = await latestSourceHealth(session.orgId);
  const counts = await prisma.lead.groupBy({
    by: ["source"],
    where: { organizationId: session.orgId },
    _count: { _all: true },
  });
  const settings = await prisma.orgSettings.findUnique({ where: { organizationId: session.orgId } });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-serif text-4xl text-navy">Settings</h1>
          <p className="mt-2 max-w-xl text-sm text-navy/65">
            Single AMFS admin login. Sessions last 30 days. Source failures email the builder, not this screen.
          </p>
        </div>
        <RefreshSources empty={false} />
      </div>
      <section className="rounded-2xl border border-navy/10 bg-white p-5">
        <h2 className="font-serif text-xl">Outreach identity</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-navy/45">From</dt>
            <dd>{settings?.emailFromName}</dd>
          </div>
          <div>
            <dt className="text-navy/45">Phone</dt>
            <dd>{settings?.emailPhone}</dd>
          </div>
          <div>
            <dt className="text-navy/45">Trailer page</dt>
            <dd>
              <a className="text-teal-800 underline" href={settings?.solutionUrl}>
                {settings?.solutionUrl}
              </a>
            </dd>
          </div>
        </dl>
      </section>
      <section className="rounded-2xl border border-navy/10 bg-white p-5">
        <h2 className="font-serif text-xl">Source last pull</h2>
        <p className="mt-1 text-sm text-navy/55">
          If a feed is late, you still see the last good leads. The operator view stays calm; the maintainer gets the alert.
        </p>
        <ul className="mt-4 divide-y divide-navy/10">
          {health.length === 0 ? (
            <li className="py-3 text-sm text-navy/55">No pulls yet.</li>
          ) : (
            health.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="font-semibold">{SOURCE_LABELS[run.source] ?? run.source}</span>
                <span className="text-navy/55">
                  {run.status === "success" ? `${run.recordsFound} records` : "Last good data retained"} · {formatDate(run.finishedAt)}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
      <section className="rounded-2xl border border-navy/10 bg-white p-5">
        <h2 className="font-serif text-xl">Leads by source</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {counts.map((c) => (
            <li key={c.source} className="flex justify-between rounded-lg bg-sand px-3 py-2 text-sm">
              <span>{SOURCE_LABELS[c.source] ?? c.source}</span>
              <span className="font-semibold">{c._count._all}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
