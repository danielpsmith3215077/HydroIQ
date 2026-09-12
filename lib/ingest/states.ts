import { fetchJson, fetchText } from "../http";
import { parsePenalty, titleCase } from "../utils";
import type { DraftLead } from "../types";
import { extractPdfText } from "./pdf-text";

const TCEQ_WATER_PROGRAMS = new Set([
  "WATER QUALITY",
  "PUBLIC WATER SUPPLY",
  "WATER RIGHTS",
  "UNDERGROUND INJECTION CONTROL",
]);

type TceqOrder = {
  program?: string;
  case_no?: string;
  tceqdocketno?: string;
  respondent_name?: string;
  county?: string;
  order_date?: string;
  penalty_assessed?: string;
  payable_amount?: string;
};

const TWDB_PPL_URL =
  "https://www.twdb.texas.gov/financial/programs/DWSRF/doc/SFY2026/SFY2026_DWSRF_Project_Priority_List_Amended.pdf";
const MN_PFA_ANNUAL_URL = "https://mn.gov/deed/assets/pfa-annual-report_tcm1045-290187.pdf";
function tceqDocketUrl(docket: string) {
  return `https://www14.tceq.texas.gov/epic/CIO/index.cfm?fuseaction=search.docketdetail&DocketNo=${encodeURIComponent(docket)}`;
}

export async function fetchTceq(): Promise<DraftLead[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - 18);
  const iso = since.toISOString().slice(0, 10);
  const url = new URL("https://data.texas.gov/resource/u66a-qggj.json");
  url.searchParams.set("$limit", "500");
  url.searchParams.set("$order", "order_date DESC");
  url.searchParams.set("$where", `order_date >= '${iso}T00:00:00'`);
  const rows = await fetchJson<TceqOrder[]>(url.toString(), { timeoutMs: 25000 });

  const leads: DraftLead[] = [];
  for (const row of rows) {
    const program = String(row.program ?? "").toUpperCase();
    if (!TCEQ_WATER_PROGRAMS.has(program)) continue;
    const name = String(row.respondent_name ?? "").replace(/^\*/u, "").trim();
    if (!name || name.length < 3) continue;
    const docket = String(row.tceqdocketno ?? row.case_no ?? "").trim();
    const fine = parsePenalty(String(row.payable_amount ?? row.penalty_assessed ?? ""));
    const county = titleCase(String(row.county ?? ""));
    leads.push({
      source: "tceq",
      variant: "live_violation",
      facilityName: name.slice(0, 160),
      city: null,
      county: county || null,
      state: "TX",
      summary: `TCEQ ${program} administrative order${fine ? ` with $${fine.toLocaleString()} payable penalty` : ""}. County: ${county || "Texas"}.`,
      detail: JSON.stringify(row).slice(0, 1200),
      violationType: `TCEQ ${titleCase(program)}`,
      fineAmount: fine && fine > 0 ? fine : null,
      sourceRecordUrl: docket ? tceqDocketUrl(docket) : "https://data.texas.gov/dataset/Texas-Commission-on-Environmental-Quality-Administ/u66a-qggj",
      sourceRecordId: `tceq-${docket || row.case_no || name}`.slice(0, 120),
      badges: ["live_violation"],
      eventDate: row.order_date ? new Date(row.order_date) : null,
      metadata: { tceq: true, program, docket },
    });
  }

  if (!leads.length) {
    throw new Error("Texas Open Data returned no recent water-program administrative orders");
  }
  return leads.slice(0, 40);
}

function parseTwdbPpl(text: string): DraftLead[] {
  const re =
    /(\d+)\s+([\d.]+)\s+(\d{5})([A-Za-z][A-Za-z0-9 '\.\-/]+)(M|W)\s+TX(\d{7})([\d,]+)\s+([\s\S]*?)P(?:AD)?C\$([\d,]+\.00)/g;
  const leads: DraftLead[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const entity = match[4].trim().replace(/\s+/g, " ");
    const description = match[8].replace(/\s+/g, " ").trim().slice(0, 320);
    const cost = Number(match[9].replace(/,/g, ""));
    if (!entity || !description) continue;
    const pwsId = match[6];
    leads.push({
      source: "srf",
      variant: "live_bid",
      facilityName: entity,
      city: entity,
      state: "TX",
      summary: `Texas DWSRF Project Priority List (SFY 2026): ${description}`,
      detail: `TWDB PWS ID ${pwsId}. Population served: ${match[7]}. Listed on the amended SFY 2026 Drinking Water SRF priority list — funded intent to build or upgrade treatment and distribution.`,
      contractType: "SRF-funded infrastructure",
      estimatedValue: Number.isFinite(cost) ? cost : null,
      sourceRecordUrl: TWDB_PPL_URL,
      sourceRecordId: `tx-dwsrf-ppl-${pwsId}-${entity}`.slice(0, 120),
      badges: ["live_bid"],
      metadata: { srf: true, twdbPpl: true, pwsId, rank: match[1] },
    });
  }
  return leads;
}

const MN_CITY_NOISE = new Set(["Water", "Waste", "Street South Water", "Bird Islandwater"]);

function parseMnPfaAwards(text: string): DraftLead[] {
  const start = text.indexOf("Bird Islandwatermain");
  const end = text.indexOf("Exhibit C", start > 0 ? start : 0);
  if (start < 0) return [];
  const slice = text.slice(start, end > start ? end : start + 12000);
  const re =
    /([A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)*?)((?:water|Water|Wastewater|wastewater|WTP|Treatment|treatment|main|Main|Collection|collection|Well|well|Plant|plant|LSLR|Lead|Rehab|Infrastruct)[^\d]{3,100})([\d,]{6,})/g;
  const leads: DraftLead[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(slice))) {
    let city = match[1].trim();
    if (city.endsWith("water")) city = city.replace(/water$/i, "").trim();
    if (MN_CITY_NOISE.has(city) || city.length < 3) continue;
    const project = match[2].replace(/\s+/g, " ").trim();
    const amount = Number(match[3].replace(/,/g, ""));
    leads.push({
      source: "srf",
      variant: "live_bid",
      facilityName: `${city} — ${project.slice(0, 80)}`,
      city,
      state: "MN",
      summary: `Minnesota PFA FY 2025 award: ${project}. MPFA financing signals budget and intent for water or wastewater infrastructure.`,
      detail: `Parsed from MPFA Annual Report Exhibit A (project awards detail).`,
      contractType: "SRF-funded infrastructure",
      estimatedValue: Number.isFinite(amount) ? amount : null,
      sourceRecordUrl: MN_PFA_ANNUAL_URL,
      sourceRecordId: `mn-pfa-${city}-${project}`.slice(0, 120),
      badges: ["live_bid"],
      metadata: { srf: true, mnPfa: true },
    });
  }
  return leads;
}

async function downloadPdf(url: string): Promise<Buffer> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": "HydroIQ/1.0 (AMFS Filtration internal lead tool)" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.slice(0, 4).toString() !== "%PDF") {
      throw new Error(`Expected PDF at ${url}`);
    }
    return buf;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchSrf(): Promise<DraftLead[]> {
  const leads: DraftLead[] = [];
  const errors: string[] = [];

  try {
    const twdbBuf = await downloadPdf(TWDB_PPL_URL);
    const twdbText = await extractPdfText(twdbBuf);
    leads.push(...parseTwdbPpl(twdbText));
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  try {
    const mnBuf = await downloadPdf(MN_PFA_ANNUAL_URL);
    const mnText = await extractPdfText(mnBuf);
    leads.push(...parseMnPfaAwards(mnText));
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  const deduped = new Map<string, DraftLead>();
  for (const lead of leads) {
    deduped.set(lead.sourceRecordId, lead);
  }
  const out = Array.from(deduped.values());
  if (!out.length) {
    throw new Error(errors.join("; ") || "SRF PDF parsers returned no projects");
  }
  const tx = out.filter((l) => l.state === "TX").slice(0, 35);
  const mn = out.filter((l) => l.state === "MN").slice(0, 25);
  const rest = out.filter((l) => l.state !== "TX" && l.state !== "MN");
  return [...tx, ...mn, ...rest].slice(0, 60);
}

type MnpcaRow = {
  siteName?: string;
  ownerName?: string;
  cityName?: string;
  countyName?: string;
  programName?: string;
  activityTypeName?: string;
  activityName?: string;
  activityId?: string;
  siteId?: string;
  lat?: string;
  long?: string;
};

async function fetchMnpcaJson(path: string): Promise<MnpcaRow[]> {
  const { text } = await fetchText(path, {
    timeoutMs: 22000,
    headers: {
      accept: "application/json",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  const pre = text.match(/<pre>\s*([\s\S]*?)\s*<\/pre>/i);
  const jsonText = pre ? pre[1] : text;
  const payload = JSON.parse(jsonText) as { data?: MnpcaRow[] };
  return payload.data ?? [];
}

export async function fetchMnpca(): Promise<DraftLead[]> {
  const queries = [
    "https://services.pca.state.mn.us/api/v1/wimn/site-activities?limit=120&searchString=wastewater",
    "https://services.pca.state.mn.us/api/v1/wimn/site-activities?limit=120&searchString=NPDES",
    "https://services.pca.state.mn.us/api/v1/wimn/site-activities?limit=80&searchString=feedlot",
  ];
  const rows: MnpcaRow[] = [];
  for (const url of queries) {
    try {
      rows.push(...(await fetchMnpcaJson(url)));
    } catch {
      // try remaining queries
    }
  }

  const leads: DraftLead[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const program = String(row.programName ?? "");
    const blob = `${program} ${row.activityName ?? ""} ${row.activityTypeName ?? ""}`;
    if (!/water|wastewater|npdes|feedlot/i.test(blob)) continue;
    const name = String(row.siteName ?? row.activityName ?? row.ownerName ?? "").trim();
    if (!name || name.length < 3) continue;
    const id = String(row.activityId ?? row.siteId ?? name).slice(0, 80);
    if (seen.has(id)) continue;
    seen.add(id);
    const city = titleCase(String(row.cityName ?? ""));
    leads.push({
      source: "mpca",
      variant: "live_violation",
      facilityName: name.slice(0, 160),
      city: city || null,
      county: row.countyName ? titleCase(row.countyName) : null,
      state: "MN",
      summary: `Minnesota PCA WIMN: ${program} — ${row.activityTypeName ?? "registered activity"} for ${name}${city ? ` (${city})` : ""}.`,
      detail: `Owner: ${row.ownerName ?? "n/a"}. Activity: ${row.activityName ?? "n/a"}.`,
      violationType: "MPCA water program activity",
      sourceRecordUrl: "https://www.pca.state.mn.us/water/watersheds/watershed-integrity-management-watershed-network-wimn",
      sourceRecordId: `mpca-wimn-${id}`,
      latitude: row.lat ? Number(row.lat) : null,
      longitude: row.long ? Number(row.long) : null,
      badges: ["live_violation"],
      metadata: { mpca: true, wimn: true, activityId: row.activityId, siteId: row.siteId },
    });
  }

  if (!leads.length) {
    throw new Error("MPCA WIMN returned no water-related site activities");
  }
  return leads.slice(0, 35);
}
