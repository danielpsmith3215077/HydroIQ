import { withDb } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeadCard } from "@/components/lead-card";
import { DbUnavailable } from "@/components/db-unavailable";
import type { Lead } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let leads: Lead[] = [];
  let dbError = false;
  try {
    leads = await withDb((db) =>
      db.lead.findMany({
        where: { organizationId: session.orgId, status: "contacted" },
        orderBy: { emailSentAt: "desc" },
      }),
    );
  } catch (err) {
    console.error("[pipeline] database unavailable", err);
    dbError = true;
  }

  return (
    <div>
      <h1 className="font-serif text-4xl text-navy">Contacted</h1>
      <p className="mt-2 text-sm text-navy/65">Leads marked sent stay here so they are not re-drafted.</p>
      <div className="mt-6 grid gap-4">
        {dbError ? (
          <DbUnavailable />
        ) : leads.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-navy/20 bg-white px-6 py-12 text-center text-navy/60">
            Nothing marked sent yet. Open a lead, edit the AMFS draft, then mark it sent.
          </p>
        ) : (
          leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
        )}
      </div>
    </div>
  );
}
