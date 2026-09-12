import { AMFS_CONTAMINANTS } from "./constants";
import type { DraftLead } from "./types";

function haystack(lead: DraftLead): string {
  return [
    lead.summary,
    lead.detail,
    lead.contaminantClass,
    lead.violationType,
    lead.facilityName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function detectContaminantClass(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/(pfas|pfoa|pfos|afff|genx|pfhxs|pfna|pfbs)/.test(t)) return "PFAS / AFFF";
  if (/\blead\b|pb\b/.test(t)) return "Lead";
  if (/arsenic/.test(t)) return "Arsenic";
  if (/selenium/.test(t)) return "Selenium";
  if (/radionucl|radium|uranium|gross alpha/.test(t)) return "Radionuclides";
  if (/nitrate|nitrite/.test(t)) return "Nitrate";
  if (/mercury/.test(t)) return "Mercury";
  if (/1,4-?\s*dioxane|dioxane/.test(t)) return "1,4-Dioxane";
  if (/ammonia/.test(t)) return "Ammonia";
  if (/tce|trichloro|pce|perchloro|voc/.test(t)) return "Chlorinated solvents / VOCs";
  if (/e\.?\s*coli|coliform|bacter/.test(t)) return "Pathogens";
  if (/bod|tss|solids, total suspended/.test(t)) return "BOD / TSS";
  if (/chlorine|chloride/.test(t)) return "Chlorine / chloride";
  return null;
}

export function scoreLead(lead: DraftLead): number {
  let score = 20;
  const text = haystack(lead);

  if (lead.variant === "live_bid") score += 35;
  if (lead.variant === "subcontract") score += 40;
  if (lead.variant === "predictive") score += 30;
  if (lead.variant === "live_violation") score += 10;

  if (lead.state === "TX" || lead.state === "MN") score += 18;
  if (["OK", "LA", "AR", "NM", "KS"].includes(lead.state)) score += 8;

  if (lead.fineAmount && lead.fineAmount > 0) {
    score += Math.min(25, Math.log10(lead.fineAmount) * 6);
  }
  if (lead.estimatedValue && lead.estimatedValue > 1_000_000) score += 20;
  else if (lead.estimatedValue && lead.estimatedValue > 250_000) score += 10;

  if (AMFS_CONTAMINANTS.some((c) => text.includes(c))) score += 16;
  if (/(pfas|afff|pfoa|pfos)/.test(text)) score += 12;
  if (/(military|air force|army|navy|marines|guard|base|fort |nas |afb)/.test(text)) score += 14;
  if (/(potw|wastewater|wwtp|water works|municipal|pws)/.test(text)) score += 8;

  const qtrs = Number(lead.metadata?.qtrsWithNc ?? lead.metadata?.qtrsWithVio ?? 0);
  if (qtrs >= 3) score += 12;
  if (qtrs >= 8) score += 8;
  if (lead.flowMgd && lead.flowMgd >= 1) score += 8;
  if (lead.flowMgd && lead.flowMgd >= 5) score += 6;

  if (/failure to report|dmr non-receipt|not received/.test(text) && !lead.contaminantClass) {
    score -= 12;
  }

  return Math.round(Math.max(1, Math.min(100, score)));
}
