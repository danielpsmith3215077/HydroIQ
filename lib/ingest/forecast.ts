import { PFAS_MILITARY_SITES } from "@/data/pfas-military-sites";
import { PRIME_CONTRACTORS } from "../constants";
import { prisma } from "../prisma";
import { detectContaminantClass } from "../scoring";
import type { DraftLead } from "../types";
import { upsertLeads } from "./upsert";

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["joint", "base", "fort", "camp", "naval", "air", "force", "army", "guard"].includes(w));
}

function overlap(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = new Set(tokens(b));
  return ta.some((t) => tb.has(t));
}

/** Algorithm A: 3+ consecutive periods of the same contaminant class → upcoming RFP. */
export async function runAlgorithmA(organizationId: string) {
  const leads = await prisma.lead.findMany({
    where: { organizationId, source: { in: ["echo_cwa", "echo_sdwa"] }, status: { not: "contacted" } },
  });
  const drafts: DraftLead[] = [];
  for (const lead of leads) {
    const meta = JSON.parse(lead.metadataJson || "{}") as { consecutive?: number; qtrsWithVio?: number; qtrsWithNc?: number };
    const consec = meta.consecutive ?? 0;
    const qtrs = meta.qtrsWithVio ?? meta.qtrsWithNc ?? 0;
    const contaminant = lead.contaminantClass || detectContaminantClass(lead.summary);
    if (!contaminant) continue;
    if (consec < 3 && qtrs < 3) continue;
    if (lead.registryId) {
      await prisma.facilitySnapshot.upsert({
        where: {
          organizationId_registryId_contaminantClass_periodKey: {
            organizationId,
            registryId: lead.registryId,
            contaminantClass: contaminant,
            periodKey: "trailing-3plus",
          },
        },
        create: {
          organizationId,
          registryId: lead.registryId,
          facilityName: lead.facilityName,
          state: lead.state,
          contaminantClass: contaminant,
          periodKey: "trailing-3plus",
          violationCount: Math.max(consec, qtrs),
          source: lead.source,
          sourceRecordUrl: lead.sourceRecordUrl,
        },
        update: { violationCount: Math.max(consec, qtrs) },
      });
    }
    const badges = Array.from(new Set([...(JSON.parse(lead.badgesJson || "[]") as string[]), "predictive"]));
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        variant: lead.variant === "subcontract" ? lead.variant : "predictive",
        forecastWindow: lead.forecastWindow ?? "3–6 months",
        contaminantClass: contaminant,
        badgesJson: JSON.stringify(badges),
      },
    });
    drafts.push({
      source: lead.source as DraftLead["source"],
      variant: "predictive",
      facilityName: lead.facilityName,
      city: lead.city,
      county: lead.county,
      state: lead.state,
      summary: lead.summary,
      detail: lead.detail,
      sourceRecordUrl: lead.sourceRecordUrl,
      sourceRecordId: lead.sourceRecordId,
      badges,
    });
  }
  return drafts.length;
}

/**
 * Algorithm B: Military PFAS watchlist sites with no recent filtration / PFAS award
 * on SAM/USAspending → pitch 53-ft trailers as emergency mitigation.
 */
export async function runAlgorithmB(organizationId: string) {
  const awards = await prisma.bidComparable.findMany({ where: { organizationId } });
  const samLeads = await prisma.lead.findMany({
    where: { organizationId, source: "sam_gov" },
  });
  const coverage = [...awards.map((a) => `${a.title} ${a.recipient} ${a.state}`), ...samLeads.map((l) => `${l.facilityName} ${l.state}`)]
    .join(" ")
    .toLowerCase();

  const drafts: DraftLead[] = [];
  for (const site of PFAS_MILITARY_SITES) {
    const siteHay = `${site.name} ${site.city}`.toLowerCase();
    const funded = overlap(siteHay, coverage) && /pfas|afff|filtr|treatment|remediat/.test(coverage);
    if (funded) continue;
    drafts.push({
      source: "pfas_watchlist",
      variant: "predictive",
      facilityName: site.name,
      city: site.city,
      state: site.state,
      summary: `${site.branch} installation on EWG / DoD PFAS watchlists (${site.notes}) with no matching active filtration or PFAS remediation award in SAM.gov / USAspending. Pitch the 53-foot trailer as immediate mitigation while MILCON waits.`,
      detail: `Watchlist is relatively static (~700+ military AFFF sites). Cross-checked against current award history for filtration/PFAS language near this installation.`,
      contaminantClass: "PFAS / AFFF",
      violationType: "Unfunded military PFAS",
      sourceRecordUrl: site.sourceUrl,
      sourceRecordId: `pfas-${site.state}-${site.name}`.slice(0, 140),
      forecastWindow: "3–9 months",
      badges: ["predictive"],
      metadata: { branch: site.branch, unfunded: true },
    });
  }
  // Keep the feed usable: TX/MN first, then a national sample of unfunded bases.
  const ranked = drafts.sort((a, b) => {
    const rank = (s: string) => (s === "TX" ? 0 : s === "MN" ? 1 : 2);
    return rank(a.state) - rank(b.state);
  });
  const keep = [
    ...ranked.filter((d) => d.state === "TX" || d.state === "MN"),
    ...ranked.filter((d) => d.state !== "TX" && d.state !== "MN").slice(0, 18),
  ];
  return upsertLeads(organizationId, keep);
}

/**
 * Algorithm C: Prime BOS / Civil Engineering umbrellas sitting on ECHO water issues.
 */
export async function runAlgorithmC(organizationId: string) {
  const awards = await prisma.lead.findMany({
    where: {
      organizationId,
      source: "sam_gov",
      OR: [{ estimatedValue: { gte: 1_000_000 } }, { contractType: { contains: "BOS" } }],
    },
  });
  const facilities = await prisma.lead.findMany({
    where: { organizationId, source: { in: ["echo_cwa", "echo_sdwa", "echo_rcra", "superfund"] } },
  });

  const drafts: DraftLead[] = [];
  for (const award of awards) {
    const prime =
      award.primeContractor ||
      PRIME_CONTRACTORS.find((p) => award.facilityName.toLowerCase().includes(p.toLowerCase()));
    if (!prime) continue;
    const match = facilities.find((f) => {
      if (f.state !== award.state) return false;
      if (award.city && f.city && award.city.toLowerCase() === f.city.toLowerCase()) return true;
      return overlap(award.facilityName, f.facilityName) || overlap(award.facilityName, `${f.city ?? ""} ${f.county ?? ""}`);
    });
    if (!match) continue;
    drafts.push({
      source: "sam_gov",
      variant: "subcontract",
      facilityName: `${match.facilityName} via ${prime}`,
      city: match.city,
      county: match.county,
      state: match.state,
      address: match.address,
      summary: `${prime} holds a large federal umbrella (${award.contractType ?? "BOS / CE"}) near ${match.facilityName}, which has an active water-compliance record: ${match.summary}`,
      detail: `Award record: ${award.sourceRecordUrl}. Facility record: ${match.sourceRecordUrl}.`,
      contaminantClass: match.contaminantClass,
      violationType: match.violationType,
      estimatedValue: award.estimatedValue,
      contractType: "Subcontract under BOS / Civil Engineering IDIQ",
      sourceRecordUrl: award.sourceRecordUrl,
      sourceRecordId: `sub-${award.sourceRecordId}-${match.sourceRecordId}`.slice(0, 160),
      registryId: match.registryId,
      primeContractor: prime,
      forecastWindow: "3–9 months",
      badges: ["subcontract"],
      metadata: { facilityUrl: match.sourceRecordUrl, awardId: award.sourceRecordId },
    });
  }
  return upsertLeads(organizationId, drafts.slice(0, 25));
}
