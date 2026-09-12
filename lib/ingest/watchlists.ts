import { PFAS_MILITARY_SITES } from "@/data/pfas-military-sites";
import { AMLIS_SITES } from "@/data/amlis-sites";
import { prisma } from "../prisma";
import type { DraftLead } from "../types";

export async function seedPfasWatchlist(organizationId: string) {
  for (const site of PFAS_MILITARY_SITES) {
    await prisma.pfasSite.upsert({
      where: {
        organizationId_name_state: {
          organizationId,
          name: site.name,
          state: site.state,
        },
      },
      create: {
        organizationId,
        name: site.name,
        city: site.city,
        state: site.state,
        branch: site.branch,
        sourceUrl: site.sourceUrl,
        notes: site.notes,
      },
      update: { city: site.city, branch: site.branch, sourceUrl: site.sourceUrl, notes: site.notes },
    });
  }
}

export function amlisLeads(): DraftLead[] {
  return AMLIS_SITES.map((s) => ({
    source: "e_amlis" as const,
    variant: "live_violation" as const,
    facilityName: s.name,
    city: s.city,
    county: s.county,
    state: s.state,
    summary: `${s.problem} These are typically state- or federally-funded reclamation projects — a funding source is already lined up.`,
    detail: `Tracked through OSMRE e-AMLIS / state AML programs. No current ECHO permit holder, so active-facility searches miss it.`,
    contaminantClass: "Acid mine drainage / metals",
    violationType: "Abandoned mine drainage",
    sourceRecordUrl: s.sourceUrl,
    sourceRecordId: s.sourceRecordId,
    badges: ["live_violation"],
    metadata: { amlis: true },
  }));
}
