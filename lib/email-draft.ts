import { AMFS } from "./constants";
import { formatMoney, titleCase } from "./utils";
import type { DraftLead } from "./types";

function solutionLink(lead: DraftLead): { label: string; url: string } {
  const c = (lead.contaminantClass ?? "").toLowerCase();
  if (c.includes("pfas") || c.includes("afff") || c.includes("pfoa") || c.includes("pfos")) {
    return { label: "AMFS PFAS / AFFF removal (DoD case study)", url: AMFS.pfasCaseStudy };
  }
  return { label: "AMFS 53-foot mobile nanofiltration trailers", url: AMFS.technology };
}

export function buildEmailDraft(lead: DraftLead): { subject: string; body: string } {
  const place = [titleCase(lead.city), lead.state].filter(Boolean).join(", ");
  const solution = solutionLink(lead);
  const fine = lead.fineAmount ? ` Public records list civil penalties of ${formatMoney(lead.fineAmount)}.` : "";
  const name = lead.facilityName;

  if (lead.variant === "subcontract" && lead.primeContractor) {
    const subject = `Mobile nanofiltration subcontractor for ${lead.primeContractor} — ${name}`;
    const body = `Hello ${lead.primeContractor} capture / subcontracting team,

HydroIQ flagged your award covering ${name}${place ? ` in ${place}` : ""} as a Base Operations / Civil Engineering umbrella that sits on top of an active water-compliance problem.

AMFS (Advanced Mobile Filtration Services, Fort Worth) is a specialized mobile filtration vendor — not a competing prime. We roll a ${AMFS.trailer} onto the site, set up with an onboard crane, and treat up to ${AMFS.capacityGpd.toLocaleString()} gallons per day with permanent vibratory nanofiltration membranes. No chemical pretreatment. No disposable cartridges to landfill. CDL operators can be anywhere in the U.S. within ${AMFS.mobilization}.

What the public record shows
${lead.summary}

Verified source
${lead.sourceRecordUrl}

How we typically slot under a BOS / CE IDIQ
• Emergency or bridging treatment while the capital plant is designed
• PFAS/AFFF, metals, leachate, and industrial wastewater at NPDES or reuse limits
• One-trailer footprint — about one-fifth of a conventional train

Capability brief: ${solution.url}
NAICS ${AMFS.naics.join(", ")} · CAGE ${AMFS.cage} · UEI ${AMFS.uei}

If you need a mobile filtration sub on this site, we can send a one-page technical insert for your proposal or a task-order quote.

${AMFS.shortName}
${AMFS.phone} · ${AMFS.email}
${AMFS.address}
`;
    return { subject, body: body.trim() };
  }

  if (lead.variant === "predictive") {
    const window = lead.forecastWindow ?? "3–9 months";
    const subject = `Interim mobile treatment for ${name}${place ? ` — ${place}` : ""} (before the RFP)`;
    const body = `Hello,

Public compliance data on ${name}${place ? ` in ${place}` : ""} now looks like a forced infrastructure project, typically ${window} before a formal RFP is posted.

${lead.summary}

That pattern is usually followed by a state-enforced upgrade or a DoD MILCON package. AMFS can put a ${AMFS.trailer} on the ground as an interim, emergency mitigation while the long-term plant is still in design and funding.

One trailer treats up to ${AMFS.capacityGpd.toLocaleString()} gpd, removes PFAS/AFFF, lead, arsenic, selenium, radionuclides, and industrial wastewater, and mobilizes to any U.S. site within ${AMFS.mobilization}. Permanent membranes — not throwaway carbon or resin.

Official public record
${lead.sourceRecordUrl}

${solution.label}: ${solution.url}

If you are already scoping options, I can send a site-specific one-pager with expected flow and discharge quality.

${AMFS.shortName} — ${AMFS.legalName}
${AMFS.phone} · ${AMFS.email}
${AMFS.address}
`;
    return { subject, body: body.trim() };
  }

  if (lead.variant === "live_bid") {
    const subject = `AMFS bid support — ${lead.contractType ?? "water treatment"} at ${name}`;
    const body = `Hello,

SAM.gov has an active opportunity that matches AMFS mobile nanofiltration work:

${name}${place ? ` · ${place}` : ""}
${lead.summary}

We can respond as prime on small mobile-treatment scopes or as a filtration subcontractor on larger remediation / BOS packages. Trailers treat up to ${AMFS.capacityGpd.toLocaleString()} gpd, chemical-free, with ${AMFS.mobilization} mobilization.

Official notice
${lead.sourceRecordUrl}

Technical sheet: ${solution.url}

CAGE ${AMFS.cage} · UEI ${AMFS.uei} · NAICS ${AMFS.naics.join(", ")}

${AMFS.shortName}
${AMFS.phone} · ${AMFS.email}
`;
    return { subject, body: body.trim() };
  }

  const subject = `Mobile nanofiltration for ${name}${place ? ` — ${place}` : ""}`;
  const body = `Hello,

I am writing from Advanced Mobile Filtration Services (AMFS) in Fort Worth. Public EPA / state records show a current water-compliance issue at ${name}${place ? ` in ${place}` : ""}.

${lead.summary}${fine}

AMFS deploys a ${AMFS.trailer} that can be on a U.S. site within ${AMFS.mobilization}. One unit treats up to ${AMFS.capacityGpd.toLocaleString()} gallons per day using permanent vibratory membranes — no chemical pretreatment and no disposable filter cartridges. We routinely take PFAS/AFFF, lead, arsenic, selenium, landfill leachate, and industrial wastewater to permitted discharge or reuse quality.

Verified public record
${lead.sourceRecordUrl}

${solution.label}
${solution.url}

If you need an emergency or bridging treatment option while a permanent fix is designed, we can walk a trailer onto the pad and start treating.

${AMFS.shortName} — ${AMFS.legalName}
${AMFS.phone} · ${AMFS.email}
${AMFS.address}
CAGE ${AMFS.cage} · UEI ${AMFS.uei}
`;
  return { subject, body: body.trim() };
}
