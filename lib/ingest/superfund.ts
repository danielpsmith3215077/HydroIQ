import { detectContaminantClass } from "../scoring";
import { fetchJson } from "../http";
import { parseNumber, titleCase } from "../utils";
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
    "https://data.epa.gov/dmapservice/sems.envirofacts_site/1:40/json",
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
    const epaId = pick(row, ["epa_id", "EPA_ID", "site_id", "SITE_ID", "REGISTRY_ID", "registry_id"]);
    const state = pick(row, ["fk_ref_state_code", "state", "STATE_CODE", "st", "STATE"]).slice(0, 2).toUpperCase();
    if (!name || !state) continue;
    const city = titleCase(pick(row, ["city", "CITY_NAME", "city_name"]));
    const county = titleCase(pick(row, ["county", "COUNTY_NAME", "county_name"]));
    const npl = pick(row, ["npl_status_name", "npl_status", "NPL_STATUS", "npl_status_code", "INTEREST_TYPE"]) || "Currently on the Final NPL";
    const recordId = pick(row, ["site_id", "epa_id"]) || `${state}-${name}`.slice(0, 80);
    const url = `https://cumulis.epa.gov/supercpad/cursites/csitinfo.cfm?id=${encodeURIComponent(recordId)}`;
    leads.push({
      source: "superfund",
      variant: "live_violation",
      facilityName: name,
      city,
      county,
      state,
      address: pick(row, ["street", "street_addr_txt", "LOCATION_ADDRESS", "address"]) || null,
      zip: pick(row, ["zip", "zip_code", "POSTAL_CODE"]) || null,
      latitude: parseNumber(pick(row, ["primary_latitude_decimal_val"])),
      longitude: parseNumber(pick(row, ["primary_longitude_decimal_val"])),
      summary: `Active Superfund / SEMS cleanup (${npl}). These sites typically have groundwater or surface-water components and a known responsible party or federal lead — multi-year remediation work.`,
      detail: `EPA ID ${epaId || "unspecified"}. Source: Superfund Enterprise Management System (SEMS), a separate EPA dataset from ECHO.`,
      contaminantClass: detectContaminantClass(JSON.stringify(row)) ?? "Groundwater / mixed contaminants",
      violationType: "Superfund / CERCLIS",
      sourceRecordUrl: url,
      sourceRecordId: epaId || recordId,
      registryId: epaId || null,
      badges: ["live_violation"],
      metadata: { npl, federalFacility: pick(row, ["federal_facility_ind"]) },
    });
  }
  return leads;
}
