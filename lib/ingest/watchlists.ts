import { PFAS_MILITARY_SITES } from "@/data/pfas-military-sites";
import { prisma } from "../prisma";

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

export { fetchAmlisLeads as amlisLeads, staticAmlisLeads } from "./amlis";
