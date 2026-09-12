import { ALL_US_STATES, PRIORITY_STATES } from "../constants";
import { fetchJson } from "../http";
import { detectContaminantClass } from "../scoring";
import { parseNumber, parsePenalty, titleCase } from "../utils";
import type { DraftLead } from "../types";
import { echoFacilityUrl } from "./upsert";

const CWA_COLS =
  "1,2,3,4,5,7,9,12,18,23,24,25,26,27,51,54,60,97,98,99,100,101,102,103,114,121,145,192,193,195,203,205";
const SDWA_COLS = "1,2,3,4,5,6,8,11,13,14,18,19,20,21,22,42,43,47,49,51,52,53,55,59,60,65";

type EchoResults = {
  Results?: {
    Message?: string;
    QueryID?: string;
    QueryRows?: string;
    Error?: { ErrorMessage?: string };
    Facilities?: Record<string, string | null>[];
    WaterSystems?: Record<string, string | null>[];
  };
};

async function echoQuery(path: string, params: Record<string, string>, pages = 2) {
  const qs = new URLSearchParams({ output: "JSON", responseset: "50", ...params });
  const first = await fetchJson<EchoResults>(`https://echodata.epa.gov/echo/${path}.get_facilities?${qs}`);
  const results = first.Results;
  if (results?.Error?.ErrorMessage) throw new Error(results.Error.ErrorMessage);
  const qid = results?.QueryID;
  if (!qid) throw new Error("ECHO did not return a QueryID");
  const facilities: Record<string, string | null>[] = [];
  const qpath = path.includes("sdw") ? "sdw_rest_services.get_qid" : `${path}.get_qid`;
  for (let page = 1; page <= pages; page += 1) {
    const pg = await fetchJson<EchoResults>(
      `https://echodata.epa.gov/echo/${qpath}?output=JSON&qid=${qid}&pageno=${page}&qcolumns=${params.qcolumns ?? ""}`,
    );
    const rows = pg.Results?.Facilities ?? [];
    if (!rows.length) break;
    facilities.push(...rows);
    if (rows.length < 20) break;
  }
  return { rows: Number(results?.QueryRows ?? facilities.length), facilities };
}

function consecutiveMarks(history: string | null | undefined): number {
  if (!history) return 0;
  const cleaned = history.replace(/[^A-Za-z]/g, "").toUpperCase();
  let n = 0;
  for (let i = cleaned.length - 1; i >= 0; i -= 1) {
    if (cleaned[i] === "V" || cleaned[i] === "S" || cleaned[i] === "E" || cleaned[i] === "X") n += 1;
    else break;
  }
  return n;
}

async function mapPool<T, R>(items: readonly T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = await Promise.all(items.slice(i, i + size).map(fn));
    out.push(...chunk);
  }
  return out;
}

function echoPages(st: string): number {
  if (PRIORITY_STATES.includes(st as (typeof PRIORITY_STATES)[number])) return 2;
  return 1;
}

export async function fetchEchoCwa(): Promise<DraftLead[]> {
  const perState = await mapPool([...ALL_US_STATES], 8, async (st) => {
    const leads: DraftLead[] = [];
    try {
    const { facilities } = await echoQuery(
      "cwa_rest_services",
      { p_st: st, p_act: "Y", p_pccs: "SNC", qcolumns: CWA_COLS },
      st === "TX" || st === "MN" ? 3 : echoPages(st),
    );
    let kept = 0;
    const ranked = facilities
      .map((f) => ({ f, pen: parsePenalty(f.CWPTotalPenalties) ?? 0, q: parseNumber(f.CWPQtrsWithNC) ?? 0 }))
      .sort((a, b) => b.pen - a.pen || b.q - a.q);

    for (const { f } of ranked) {
      const name = f.CWPName?.trim();
      const permit = f.SourceID?.trim();
      if (!name || !permit) continue;
      const pollutants = f.PollWithViolation ?? "";
      const status = f.CWPStatus ?? "Significant Noncompliance";
      const qtrs = parseNumber(f.CWPQtrsWithNC) ?? 0;
      const major = (f.CWPMajorMinorStatusFlag ?? "") === "Y";
      const pen = parsePenalty(f.CWPTotalPenalties);
      const history = f.CWP13qtrsComplHistory ?? "";
      const consec = consecutiveMarks(history);
      const contaminant = detectContaminantClass(pollutants) ?? detectContaminantClass(f.CWPSNCStatus);
      const weak = /dmr non-receipt|failure to report|not received/i.test(f.CWPVioStatus ?? "") && !pollutants;
      if (weak && !major && !pen && qtrs < 6) continue;
      if (kept >= (st === "TX" || st === "MN" ? 28 : 10)) break;

      const predictive = consec >= 3 && Boolean(contaminant);
      const badges = ["live_violation"];
      if (predictive) badges.push("predictive");

      const summary = [
        `${status}.`,
        f.CWPSNCEventDesc || f.CWPVioStatus || f.CWPSNCStatus,
        pollutants ? `Pollutants in violation: ${pollutants.replace(/\|/g, ", ")}.` : null,
        qtrs ? `${qtrs} of the last 12 quarters in noncompliance.` : null,
        pen ? `Civil penalties on record (5-year): ${f.CWPTotalPenalties}.` : null,
      ]
        .filter(Boolean)
        .join(" ");

      leads.push({
        source: "echo_cwa",
        variant: predictive ? "predictive" : "live_violation",
        facilityName: name,
        city: titleCase(f.CWPCity),
        county: titleCase(f.CWPCounty),
        state: f.CWPState || st,
        address: f.CWPStreet,
        zip: f.CWPZip,
        latitude: parseNumber(f.FacLat),
        longitude: parseNumber(f.FacLong),
        summary,
        detail: [
          `NPDES ${permit}.`,
          f.CWPPermitTypeDesc,
          f.FacFederalAgencyName ? `Federal agency: ${f.FacFederalAgencyName}.` : null,
          history ? `13-quarter history: ${history}.` : null,
          f.CWPDateLastPenalty ? `Last penalty date: ${f.CWPDateLastPenalty}.` : null,
        ]
          .filter(Boolean)
          .join(" "),
        contaminantClass: contaminant,
        violationType: f.CWPSNCEventDesc || f.CWPVioStatus || status,
        fineAmount: pen && pen > 0 ? pen : null,
        sourceRecordUrl: echoFacilityUrl(f.RegistryID, permit),
        sourceRecordId: permit,
        registryId: f.RegistryID,
        permitId: permit,
        eventDate: f.CWPSNCStatusDate ? new Date(f.CWPSNCStatusDate) : null,
        forecastWindow: predictive ? "3–6 months" : null,
        complianceHistory: history,
        flowMgd: parseNumber(f.CWPActualAverageFlowNmbr) ?? parseNumber(f.CWPTotalDesignFlowNmbr),
        badges,
        metadata: {
          qtrsWithNc: qtrs,
          qtrsWithSnc: parseNumber(f.CWPQtrsWithSNC),
          major,
          consecutive: consec,
          pollutants,
        },
      });
      kept += 1;
    }

    if (st === "TX" || st === "MN") {
      const penalized = await echoQuery(
        "cwa_rest_services",
        { p_st: st, p_pen: "LE12", qcolumns: CWA_COLS },
        1,
      );
      for (const f of penalized.facilities.slice(0, 12)) {
        const name = f.CWPName?.trim();
        const permit = f.SourceID?.trim();
        if (!name || !permit) continue;
        if (leads.some((l) => l.sourceRecordId === permit)) continue;
        const pen = parsePenalty(f.CWPTotalPenalties);
        leads.push({
          source: "echo_cwa",
          variant: "live_violation",
          facilityName: name,
          city: titleCase(f.CWPCity),
          county: titleCase(f.CWPCounty),
          state: f.CWPState || st,
          address: f.CWPStreet,
          zip: f.CWPZip,
          latitude: parseNumber(f.FacLat),
          longitude: parseNumber(f.FacLong),
          summary: `Recent Clean Water Act penalty activity. 5-year penalties ${f.CWPTotalPenalties ?? "listed"}. ${f.CWPStatus ?? ""} ${f.PollWithViolation ? `Pollutants: ${f.PollWithViolation.replace(/\|/g, ", ")}` : ""}`.trim(),
          detail: `NPDES ${permit}. Last penalty ${f.CWPDateLastPenalty ?? "n/a"}.`,
          contaminantClass: detectContaminantClass(f.PollWithViolation),
          violationType: f.CWPStatus,
          fineAmount: pen && pen > 0 ? pen : null,
          sourceRecordUrl: echoFacilityUrl(f.RegistryID, permit),
          sourceRecordId: `${permit}-PEN`,
          registryId: f.RegistryID,
          permitId: permit,
          eventDate: f.CWPDateLastPenalty ? new Date(f.CWPDateLastPenalty) : null,
          flowMgd: parseNumber(f.CWPActualAverageFlowNmbr),
          badges: ["live_violation"],
          metadata: { penaltyPull: true },
        });
      }
    }
    } catch {
      return leads;
    }
    return leads;
  });
  const all = perState.flat();
  if (!all.length) throw new Error("ECHO CWA returned no SNC facilities across U.S. states");
  return all;
}

export async function fetchEchoSdwa(): Promise<DraftLead[]> {
  const perState = await mapPool([...ALL_US_STATES], 8, async (st) => {
    const leads: DraftLead[] = [];
    try {
    const start = await fetchJson<EchoResults>(
      `https://echodata.epa.gov/echo/sdw_rest_services.get_systems?output=JSON&p_st=${st}&p_sv=Y&responseset=40&qcolumns=${SDWA_COLS}`,
    );
    if (start.Results?.Error?.ErrorMessage) throw new Error(start.Results.Error.ErrorMessage);
    const qid = start.Results?.QueryID;
    if (!qid) return leads;
    const pg = await fetchJson<EchoResults>(
      `https://echodata.epa.gov/echo/sdw_rest_services.get_qid?output=JSON&qid=${qid}&pageno=1&qcolumns=${SDWA_COLS}`,
    );
    const facilities = pg.Results?.WaterSystems ?? pg.Results?.Facilities ?? [];
    let kept = 0;
    for (const f of facilities) {
      const name = f.PWSName?.trim();
      const pwsid = f.PWSId?.trim();
      if (!name || !pwsid) continue;
      const contaminants = f.SDWAContaminantsInCurViol || f.SDWAContaminantsInViol3yr || f.SDWAContaminants || "";
      const qtrs = parseNumber(f.QtrsWithVio) ?? 0;
      const history = f.SDWA3yrComplQtrsHistory ?? "";
      const consec = consecutiveMarks(history);
      const health = (f.HealthFlag ?? "").toString().toUpperCase() === "Y" || f.HealthFlag === "1";
      const leadCu = (f.LeadAndCopperViol ?? f.PbViol ?? "") === "Y" || f.PbViol === "1";
      const contaminant =
        detectContaminantClass(contaminants) ??
        (leadCu ? "Lead" : detectContaminantClass(f.ViolationCategories));
      const predictive = qtrs >= 3 && Boolean(contaminant);
      if (kept >= (st === "TX" || st === "MN" ? 18 : 6)) break;
      const summary = [
        `Public water system in serious SDWA violation${health ? " with a health-based (MCL) flag" : ""}.`,
        contaminants ? `Current / 3-year contaminants: ${String(contaminants).replace(/\|/g, ", ")}.` : null,
        qtrs ? `${qtrs} quarters with violations.` : null,
        f.PopulationServedCount ? `Population served: ${Number(f.PopulationServedCount).toLocaleString()}.` : null,
      ]
        .filter(Boolean)
        .join(" ");
      leads.push({
        source: "echo_sdwa",
        variant: predictive ? "predictive" : "live_violation",
        facilityName: name,
        city: titleCase((f.CitiesServed ?? "").split(",")[0]),
        county: titleCase((f.CountiesServed ?? "").split(",")[0]),
        state: f.StateCode || st,
        zip: (f.ZipCodesServed ?? "").split(",")[0],
        summary,
        detail: [
          `PWSID ${pwsid}.`,
          f.PWSTypeDesc,
          f.PrimarySourceDesc,
          f.OwnerDesc,
          history ? `Compliance history: ${history}.` : null,
        ]
          .filter(Boolean)
          .join(" "),
        contaminantClass: contaminant,
        violationType: f.ViolationCategories || (health ? "Health-based MCL" : "SDWA serious violator"),
        sourceRecordUrl: f.DfrUrl || echoFacilityUrl(f.RegistryID, pwsid),
        sourceRecordId: pwsid,
        registryId: f.RegistryID,
        permitId: pwsid,
        forecastWindow: predictive ? "3–6 months" : null,
        complianceHistory: history,
        badges: predictive ? ["live_violation", "predictive"] : ["live_violation"],
        metadata: {
          qtrsWithVio: qtrs,
          qtrsWithSnc: parseNumber(f.QtrsWithSNC),
          consecutive: consec,
          population: parseNumber(f.PopulationServedCount),
          health,
        },
      });
      kept += 1;
    }
    } catch {
      return leads;
    }
    return leads;
  });
  const all = perState.flat();
  if (!all.length) throw new Error("ECHO SDWA returned no serious violators across U.S. states");
  return all;
}

export async function fetchEchoRcra(): Promise<DraftLead[]> {
  const leads: DraftLead[] = [];
  const tries = [
    { p_ncap: "Y" },
    { p_ca: "Y" },
    { p_cact: "CA" },
  ];
  for (const st of ["TX", "MN", "OK", "LA", "CA", "PA", "OH", "NJ"]) {
    let facilities: Record<string, string | null>[] = [];
    for (const extra of tries) {
      try {
        const qs = new URLSearchParams();
        qs.set("output", "JSON");
        qs.set("p_st", st);
        qs.set("responseset", "25");
        Object.entries(extra).forEach(([k, v]) => qs.set(k, v));
        const first = await fetchJson<EchoResults>(
          `https://echodata.epa.gov/echo/rcra_rest_services.get_facilities?${qs}`,
        );
        if (first.Results?.Error?.ErrorMessage) {
          continue;
        }
        const qid = first.Results?.QueryID;
        if (!qid) continue;
        const page = await fetchJson<EchoResults>(
          `https://echodata.epa.gov/echo/rcra_rest_services.get_qid?output=JSON&qid=${qid}&pageno=1`,
        );
        facilities = page.Results?.Facilities ?? [];
        if (facilities.length) break;
      } catch {
        continue;
      }
    }
    if (!facilities.length) continue;
    for (const f of facilities.slice(0, 8)) {
      const name = (f.FAC_NAME || f.CWPName || f.FacilityName || f.RCRAName || Object.values(f)[0] || "").toString();
      const id =
        (f.REGISTRY_ID || f.RegistryID || f.HANDLER_ID || f.SourceID || f.ID_NUMBER || "").toString() ||
        `${st}-${name}`.slice(0, 80);
      if (!name || name.length < 3) continue;
      const city = (f.FAC_CITY || f.City || f.CWPCity || "").toString();
      const county = (f.FAC_COUNTY || f.County || "").toString();
      const registry = (f.REGISTRY_ID || f.RegistryID || "").toString() || null;
      leads.push({
        source: "echo_rcra",
        variant: "live_violation",
        facilityName: name,
        city: titleCase(city),
        county: titleCase(county),
        state: (f.FAC_STATE || f.State || st).toString(),
        address: (f.FAC_STREET || f.Street || "").toString() || null,
        summary:
          "Facility on EPA's RCRA Corrective Action universe — a formal cleanup order for hazardous waste that can contaminate groundwater. Legal obligation to fix, which is a time-pressured contract signal.",
        detail: JSON.stringify(
          Object.fromEntries(
            Object.entries(f).filter(([, v]) => v && String(v).length < 180),
          ),
        ).slice(0, 1500),
        contaminantClass: "Hazardous waste / groundwater",
        violationType: "RCRA Corrective Action",
        sourceRecordUrl: echoFacilityUrl(registry, id),
        sourceRecordId: id,
        registryId: registry,
        badges: ["live_violation"],
        metadata: { rcra: true },
      });
    }
  }
  return leads;
}
