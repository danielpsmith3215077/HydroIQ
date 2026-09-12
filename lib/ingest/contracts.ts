import { BOS_KEYWORDS, PRIME_CONTRACTORS, WATER_KEYWORDS } from "../constants";
import { fetchJson } from "../http";
import { prisma } from "../prisma";
import type { DraftLead } from "../types";

type SamOpp = {
  noticeId?: string;
  title?: string;
  solicitationNumber?: string;
  fullParentPathName?: string;
  type?: string;
  baseType?: string;
  postedDate?: string;
  archiveDate?: string;
  naicsCode?: string;
  classificationCode?: string;
  active?: string;
  uiLink?: string;
  description?: string;
  pointOfContact?: Array<{ fullName?: string; email?: string }>;
  placeOfPerformance?: { city?: { name?: string }; state?: { name?: string; code?: string } };
  award?: { amount?: string; date?: string; awardee?: { name?: string } };
};

async function fetchSamOfficial(): Promise<SamOpp[]> {
  const key = process.env.SAM_API_KEY;
  if (!key) return [];
  const postedTo = new Date();
  const postedFrom = new Date();
  postedFrom.setDate(postedFrom.getDate() - 30);
  const fmt = (d: Date) =>
    `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
  const keywords = ["water treatment", "PFAS", "filtration", "groundwater remediation"];
  const out: SamOpp[] = [];
  for (const q of keywords) {
    const url = new URL("https://api.sam.gov/opportunities/v2/search");
    url.searchParams.set("api_key", key);
    url.searchParams.set("postedFrom", fmt(postedFrom));
    url.searchParams.set("postedTo", fmt(postedTo));
    url.searchParams.set("limit", "25");
    url.searchParams.set("offset", "0");
    url.searchParams.set("title", q);
    url.searchParams.set("ptype", "o,k,p,r");
    const json = await fetchJson<{ opportunitiesData?: SamOpp[] }>(url.toString());
    out.push(...(json.opportunitiesData ?? []));
  }
  return out;
}

async function fetchSamPublic(): Promise<SamOpp[]> {
  const postedTo = new Date();
  const postedFrom = new Date();
  postedFrom.setDate(postedFrom.getDate() - 21);
  const fmt = (d: Date) =>
    `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
  const url = new URL("https://sam.gov/api/prod/opportunities/v2/search");
  url.searchParams.set("limit", "40");
  url.searchParams.set("offset", "0");
  url.searchParams.set("postedFrom", fmt(postedFrom));
  url.searchParams.set("postedTo", fmt(postedTo));
  url.searchParams.set("q", "water treatment OR PFAS OR filtration OR wastewater remediation");
  try {
    const json = await fetchJson<{ opportunitiesData?: SamOpp[]; _embedded?: { results?: SamOpp[] } }>(
      url.toString(),
    );
    return json.opportunitiesData ?? json._embedded?.results ?? [];
  } catch {
    return [];
  }
}

type UsaAward = Record<string, string | number | null>;

export async function fetchUsaSpendingAwards(): Promise<{ leads: DraftLead[]; comparables: UsaAward[] }> {
  const body = {
    filters: {
      award_type_codes: ["A", "B", "C", "D"],
      keywords: [...WATER_KEYWORDS, ...BOS_KEYWORDS, "PFAS", "AFFF", "nanofiltration"],
      time_period: [
        {
          start_date: "2023-01-01",
          end_date: new Date().toISOString().slice(0, 10),
        },
      ],
      naics_codes: ["562910", "221310", "562211", "237110"],
    },
    fields: [
      "Award ID",
      "Recipient Name",
      "Award Amount",
      "Description",
      "Start Date",
      "End Date",
      "Awarding Agency",
      "Awarding Sub Agency",
      "Place of Performance State Code",
      "Place of Performance City Name",
      "NAICS Code",
      "NAICS Description",
      "generated_internal_id",
    ],
    limit: 80,
    page: 1,
    sort: "Award Amount",
    order: "desc",
  };

  const json = await fetchJson<{ results?: UsaAward[] }>("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    timeoutMs: 25000,
  });
  const results = json.results ?? [];
  const leads: DraftLead[] = [];

  for (const row of results.slice(0, 50)) {
    const title = String(row["Description"] || row["Award ID"] || "Federal award");
    const recipient = String(row["Recipient Name"] || "");
    const amount = Number(row["Award Amount"] || 0);
    const state = String(row["Place of Performance State Code"] || "US").slice(0, 2).toUpperCase();
    const city = String(row["Place of Performance City Name"] || "");
    const id = String(row["generated_internal_id"] || row["Award ID"] || title).slice(0, 120);
    const prime = PRIME_CONTRACTORS.find((p) => recipient.toLowerCase().includes(p.toLowerCase()));
    const hay = `${title} ${recipient} ${row["NAICS Description"] ?? ""}`.toLowerCase();
    const bos = BOS_KEYWORDS.some((k) => hay.includes(k.toLowerCase()));
    const water = WATER_KEYWORDS.some((k) => hay.includes(k.toLowerCase()));
    if (!bos && !water && amount < 5_000_000) continue;

    const variant = prime && (bos || amount >= 5_000_000) ? "subcontract" : water ? "live_bid" : "subcontract";
    const badges = variant === "subcontract" ? ["subcontract"] : ["live_bid"];
    leads.push({
      source: "sam_gov",
      variant,
      facilityName: `${recipient || "Federal award"} — ${title}`.slice(0, 180),
      city,
      state: state || "US",
      summary: [
        `${row["Awarding Agency"] ?? "Federal agency"} awarded ${recipient || "a contractor"} ${amount ? `$${amount.toLocaleString()}` : "an undisclosed amount"}.`,
        water ? "Scope language matches water treatment / remediation / filtration." : null,
        bos ? "Read as a BOS / civil-engineering umbrella — AMFS can sit as the mobile filtration sub." : null,
        row["NAICS Description"] ? `NAICS: ${row["NAICS Description"]}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
      detail: String(row["Description"] ?? title),
      contractType: bos ? "BOS / Civil Engineering umbrella" : "Water treatment / remediation",
      estimatedValue: amount || null,
      sourceRecordUrl: `https://www.usaspending.gov/award/${encodeURIComponent(id)}`,
      sourceRecordId: id,
      eventDate: row["Start Date"] ? new Date(String(row["Start Date"])) : null,
      primeContractor: prime ?? recipient ?? null,
      badges,
      metadata: { naics: row["NAICS Code"], usa: true },
    });
  }

  return { leads, comparables: results };
}

function mapSamOpp(o: SamOpp): DraftLead | null {
  const title = o.title?.trim();
  const id = o.noticeId || o.solicitationNumber;
  if (!title || !id) return null;
  const state = o.placeOfPerformance?.state?.code || "US";
  const city = o.placeOfPerformance?.city?.name || "";
  const hay = `${title} ${o.description ?? ""} ${o.fullParentPathName ?? ""}`.toLowerCase();
  if (![...WATER_KEYWORDS, "pfas", "afff", "wastewater", "groundwater"].some((k) => hay.includes(k.toLowerCase()))) {
    if (!/water|filtr|remediat|pfas|leachate/i.test(title)) return null;
  }
  const url = o.uiLink || `https://sam.gov/opp/${o.noticeId}/view`;
  const amount = o.award?.amount ? Number(String(o.award.amount).replace(/[^0-9.]/g, "")) : null;
  return {
    source: "sam_gov",
    variant: "live_bid",
    facilityName: title,
    city,
    state,
    summary: `Active SAM.gov ${o.type || o.baseType || "opportunity"} from ${o.fullParentPathName || "a federal agency"}. ${title}`,
    detail: o.description?.slice(0, 1500) || title,
    contractType: o.type || o.baseType || "Solicitation",
    estimatedValue: amount && Number.isFinite(amount) ? amount : null,
    sourceRecordUrl: url,
    sourceRecordId: id,
    eventDate: o.postedDate ? new Date(o.postedDate) : null,
    badges: ["live_bid"],
    metadata: { naics: o.naicsCode, solicitation: o.solicitationNumber },
  };
}

export async function fetchSamOpportunities(): Promise<DraftLead[]> {
  const official = await fetchSamOfficial();
  const pub = official.length ? [] : await fetchSamPublic();
  const mapped = [...official, ...pub].map(mapSamOpp).filter((x): x is DraftLead => Boolean(x));
  const seen = new Set<string>();
  return mapped.filter((l) => {
    if (seen.has(l.sourceRecordId)) return false;
    seen.add(l.sourceRecordId);
    return true;
  });
}

export async function storeComparables(organizationId: string, rows: UsaAward[]) {
  for (const row of rows) {
    const id = String(row["generated_internal_id"] || row["Award ID"] || "").slice(0, 120);
    if (!id) continue;
    const amount = Number(row["Award Amount"] || 0);
    if (!amount) continue;
    await prisma.bidComparable.upsert({
      where: { organizationId_sourceRecordId: { organizationId, sourceRecordId: id } },
      create: {
        organizationId,
        sourceRecordId: id,
        title: String(row["Description"] || row["Award ID"] || "Award").slice(0, 240),
        recipient: String(row["Recipient Name"] || "") || null,
        agency: String(row["Awarding Agency"] || "") || null,
        awardAmount: amount,
        awardedAt: row["Start Date"] ? new Date(String(row["Start Date"])) : null,
        naics: String(row["NAICS Code"] || "") || null,
        state: String(row["Place of Performance State Code"] || "") || null,
        sourceUrl: `https://www.usaspending.gov/award/${encodeURIComponent(id)}`,
        keywords: `${row["NAICS Description"] ?? ""} ${row["Description"] ?? ""}`.slice(0, 500),
        description: String(row["Description"] ?? "").slice(0, 1000),
      },
      update: { awardAmount: amount },
    });
  }
}
