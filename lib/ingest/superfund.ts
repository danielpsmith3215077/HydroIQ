import { detectContaminantClass } from "../scoring";
import { fetchJson } from "../http";
import { titleCase } from "../utils";
import type { DraftLead } from "../types";

type SemsRow = Record<string, unknown>;

function pick(row: SemsRow, keys: string[]): string {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

function flatten(payload: unknown): SemsRow[] {
  if (Array.isArray(payload)) {
    return payload.map((row) => {
      if (row && typeof row === "object" && "envirofacts_site" in (row as object)) {
        return (row as { envirofacts_site: SemsRow }).envirofacts_site;
      }
      return row as SemsRow;
    });
  }
  if (payload && typeof payload === "object") {
    const rec = payload as Record<string, unknown>;
    if (Array.isArray(rec.features)) {
      return (rec.features as Array<{ attributes?: SemsRow; properties?: SemsRow }>).map(
        (f) => f.attributes ?? f.properties ?? {},
      );
    }
    if (Array.isArray(rec.data)) return rec.data as SemsRow[];
  }
  return [];
}

export async function fetchSuperfund(): Promise<DraftLead[]> {
  const endpoints = [
    "https://data.epa.gov/dmapservice/sems.envirofacts_site/npl_status_code/equals/F/1:40/json",
    "https://data.epa.gov/efservice/envirofacts_site/npl_status/Currently%20on%20the%20Final%20NPL/JSON/rows/0:39",
    "https://enviro.epa.gov/enviro/efservice/envirofacts_site/npl_status/Currently%20on%20the%20Final%20NPL/JSON/rows/0:39",
    "https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/FRS_INTERESTS_SEMS/FeatureServer/0/query?where=PRIMARY_NAME%20IS%20NOT%20NULL&outFields=PRIMARY_NAME,CITY_NAME,STATE_CODE,COUNTY_NAME,REGISTRY_ID,LOCATION_ADDRESS,POSTAL_CODE,INTEREST_TYPE&resultRecordCount=40&f=json",
  ];

  let rows: SemsRow[] = [];
  let lastErr = "";
  for (const url of endpoints) {
    try {
      const payload = await fetchJson<unknown>(url, { timeoutMs: 20000 });
      rows = flatten(payload);
      if (rows.length) break;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }
  if (!rows.length) {
    throw new Error(lastErr || "Superfund / SEMS returned no rows from public EPA endpoints");
  }

  const leads: DraftLead[] = [];
  for (const row of rows.slice(0, 40)) {
    const name = pick(row, ["site_name", "SITE_NAME", "PRIMARY_NAME", "fac_name", "name"]);
    const epaId = pick(row, ["site_id", "SITE_ID", "epa_id", "EPA_ID", "REGISTRY_ID", "registry_id"]);
    const state = pick(row, ["state", "STATE_CODE", "st", "STATE"]).slice(0, 2).toUpperCase();
    if (!name || !state) continue;
    const city = titleCase(pick(row, ["city", "CITY_NAME", "city_name"]));
    const county = titleCase(pick(row, ["county", "COUNTY_NAME", "county_name"]));
    const npl = pick(row, ["npl_status", "NPL_STATUS", "npl_status_code", "INTEREST_TYPE"]) || "NPL / SEMS site";
    const url = epaId
      ? `https://cumulis.epa.gov/supercpad/cursites/csitinfo.cfm?id=${encodeURIComponent(epaId)}`
      : `https://www.epa.gov/superfund`;
    leads.push({
      source: "superfund",
      variant: "live_violation",
      facilityName: name,
      city,
      county,
      state,
      address: pick(row, ["street", "LOCATION_ADDRESS", "address"]) || null,
      zip: pick(row, ["zip", "POSTAL_CODE", "zip_code"]) || null,
      summary: `Active Superfund / SEMS cleanup (${npl}). These sites typically have groundwater or surface-water components and a known responsible party or federal lead — multi-year remediation work.`,
      detail: `EPA site id ${epaId || "unspecified"}. Source: Superfund Enterprise Management System (SEMS), separate from ECHO.`,
      contaminantClass: detectContaminantClass(JSON.stringify(row)) ?? "Groundwater / mixed contaminants",
      violationType: "Superfund / CERCLIS",
      sourceRecordUrl: url,
      sourceRecordId: epaId || `${state}-${name}`.slice(0, 80),
      registryId: epaId || null,
      badges: ["live_violation"],
      metadata: { npl },
    });
  }
  return leads;
}
