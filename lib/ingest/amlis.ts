import { PRIORITY_STATES } from "../constants";
import { fetchJson } from "../http";
import { AMLIS_SITES } from "@/data/amlis-sites";
import type { DraftLead } from "../types";

type OsmreFeature = {
  attributes?: {
    project_name?: string;
    project_description?: string;
    county?: string;
    state?: string;
    year?: number;
    osmre_award_link?: string;
    agency?: string;
  };
};

type OsmreQuery = {
  features?: OsmreFeature[];
  exceededTransferLimit?: boolean;
};

const OSMRE_LAYER =
  "https://geoservices.osmre.gov/arcgis/rest/services/GeoMine/OSMRE_AML_Awards/MapServer/0/query";

const WATER_AMD =
  /acid mine|amd|mine drainage|drainage|reclamation|water quality|stream|watershed|treatment plant|sludge|contaminant|metals|iron|manganese|aluminum/i;

async function fetchOsmrePage(offset: number): Promise<OsmreFeature[]> {
  const states = PRIORITY_STATES.map((s) => `'${s}'`).join(",");
  const url = new URL(OSMRE_LAYER);
  url.searchParams.set("where", `state IN (${states})`);
  url.searchParams.set("outFields", "project_name,project_description,county,state,year,osmre_award_link,agency");
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("f", "json");
  url.searchParams.set("resultRecordCount", "100");
  url.searchParams.set("resultOffset", String(offset));
  const json = await fetchJson<OsmreQuery>(url.toString(), { timeoutMs: 25000 });
  return json.features ?? [];
}

function featureToLead(f: OsmreFeature): DraftLead | null {
  const a = f.attributes;
  const name = a?.project_name?.trim();
  const state = a?.state?.trim()?.slice(0, 2).toUpperCase();
  const desc = a?.project_description?.trim() ?? "";
  if (!name || !state || state.length !== 2) return null;
  if (!WATER_AMD.test(`${name} ${desc}`)) return null;
  const id = `osmre-${state}-${name}`.slice(0, 120);
  const link =
    a?.osmre_award_link?.startsWith("http") ?
      a.osmre_award_link
    : "https://www.osmre.gov/programs/abandoned-mine-land-reclamation";
  return {
    source: "e_amlis",
    variant: "live_violation",
    facilityName: name,
    city: null,
    county: a?.county ?? null,
    state,
    summary: `${desc.slice(0, 220)} OSMRE GeoMine documents funded abandoned-mine work — treatment or drainage control is often part of the scope.`,
    detail: desc.slice(0, 1200),
    contaminantClass: "Acid mine drainage / metals",
    violationType: "Abandoned mine drainage",
    sourceRecordUrl: link,
    sourceRecordId: id,
    badges: ["live_violation"],
    metadata: { amlis: true, osmreLive: true, year: a?.year, agency: a?.agency },
  };
}

function staticLeads(): DraftLead[] {
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
    metadata: { amlis: true, curated: true },
  }));
}

export async function fetchAmlisLeads(): Promise<DraftLead[]> {
  const byId = new Map<string, DraftLead>();
  for (const lead of staticLeads()) {
    byId.set(lead.sourceRecordId, lead);
  }

  try {
    let offset = 0;
    for (let page = 0; page < 6; page += 1) {
      const features = await fetchOsmrePage(offset);
      if (!features.length) break;
      for (const f of features) {
        const lead = featureToLead(f);
        if (lead) byId.set(lead.sourceRecordId, lead);
      }
      offset += features.length;
      if (features.length < 100) break;
    }
  } catch {
    // Curated list still satisfies the source when GeoMine is unreachable.
  }

  return Array.from(byId.values()).slice(0, 80);
}
