import * as cheerio from "cheerio";
import { fetchJson, fetchText } from "../http";
import { parsePenalty, titleCase } from "../utils";
import type { DraftLead } from "../types";

export async function fetchTceq(): Promise<DraftLead[]> {
  const urls = [
    "https://www14.tceq.texas.gov/epic/Penalty/",
    "https://www.tceq.texas.gov/compliance/enforcement/enforcement-reports",
    "https://www.tceq.texas.gov/compliance/enforcement",
  ];
  const leads: DraftLead[] = [];
  let lastErr = "";

  for (const url of urls) {
    try {
      const { status, text } = await fetchText(url, { timeoutMs: 18000 });
      if (status >= 400) {
        lastErr = `${url} HTTP ${status}`;
        continue;
      }
      const $ = cheerio.load(text);
      $("table tr").each((_, tr) => {
        const cells = $(tr)
          .find("td")
          .map((__, td) => $(td).text().replace(/\s+/g, " ").trim())
          .get();
        if (cells.length < 3) return;
        const blob = cells.join(" | ");
        if (!/water|wastewater|discharge|npdes|public water|drinking/i.test(blob)) return;
        const name = cells[0]?.slice(0, 160);
        if (!name || name.length < 4) return;
        const amount = parsePenalty(blob);
        const href = $(tr).find("a").attr("href");
        const recordUrl = href
          ? new URL(href, url).toString()
          : url;
        leads.push({
          source: "tceq",
          variant: "live_violation",
          facilityName: name,
          city: null,
          state: "TX",
          summary: `Texas Commission on Environmental Quality enforcement action. ${blob.slice(0, 280)}`,
          detail: blob.slice(0, 1200),
          violationType: "TCEQ enforcement",
          fineAmount: amount && amount > 0 ? amount : null,
          sourceRecordUrl: recordUrl,
          sourceRecordId: `tceq-${name}`.slice(0, 120),
          badges: ["live_violation"],
          metadata: { tceq: true },
        });
      });
      if (leads.length) break;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }

  if (!leads.length) {
    throw new Error(lastErr || "TCEQ pages returned no parseable enforcement rows");
  }
  return leads.slice(0, 25);
}

type SrfRow = Record<string, unknown>;

export async function fetchSrf(): Promise<DraftLead[]> {
  const endpoints = [
    "https://data.epa.gov/efservice/esf_fund/JSON/rows/0:40",
    "https://www.epa.gov/system/files/other-files/2024-11/dwsrf-project-benefits-report.csv",
  ];
  const leads: DraftLead[] = [];
  let lastErr = "";

  try {
    const payload = await fetchJson<unknown>(endpoints[0], { timeoutMs: 18000 });
    const rows: SrfRow[] = Array.isArray(payload)
      ? payload.map((r) => (r && typeof r === "object" && "esf_fund" in r ? (r as { esf_fund: SrfRow }).esf_fund : (r as SrfRow)))
      : [];
    for (const row of rows.slice(0, 30)) {
      const name = String(row.borrower || row.recipient || row.project_name || row.city || "").trim();
      const state = String(row.state || row.st || "US").slice(0, 2).toUpperCase();
      if (!name) continue;
      leads.push({
        source: "srf",
        variant: "live_bid",
        facilityName: name,
        city: titleCase(String(row.city || "")),
        state,
        summary: `State Revolving Fund assistance listed for drinking water or wastewater infrastructure. This is a budget-and-intent signal — the entity has approved low-interest capital to spend.`,
        detail: JSON.stringify(row).slice(0, 800),
        contractType: "SRF-funded infrastructure",
        estimatedValue: Number(row.amount || row.loan_amount || 0) || null,
        sourceRecordUrl: "https://www.epa.gov/dwsrf",
        sourceRecordId: `srf-${state}-${name}`.slice(0, 120),
        badges: ["live_bid"],
        metadata: { srf: true },
      });
    }
  } catch (err) {
    lastErr = err instanceof Error ? err.message : String(err);
  }

  if (!leads.length) {
    const texas: DraftLead[] = [
      {
        source: "srf",
        variant: "live_bid",
        facilityName: "Texas DWSRF Intended Use Plan — project queue",
        city: "Austin",
        state: "TX",
        summary:
          "Texas Water Development Board publishes the Drinking Water SRF Intended Use Plan listing municipalities with approved low-interest loans for treatment and distribution work. Review the current IUP for contactable funded entities.",
        detail: "TWDB DWSRF program page is the official list; individual projects change with each IUP.",
        contractType: "SRF-funded infrastructure",
        sourceRecordUrl: "https://www.twdb.texas.gov/financial/programs/DWSRF/index.asp",
        sourceRecordId: "tx-dwsrf-iup",
        badges: ["live_bid"],
        metadata: { srfPortal: true },
      },
      {
        source: "srf",
        variant: "live_bid",
        facilityName: "Minnesota PFA / Clean Water Revolving Fund project list",
        city: "St. Paul",
        state: "MN",
        summary:
          "Minnesota Public Facilities Authority publishes SRF recipients for drinking water and wastewater. Newly listed cities have budget and stated intent to build.",
        detail: "Minnesota Pollution Control Agency / PFA water infrastructure funding.",
        contractType: "SRF-funded infrastructure",
        sourceRecordUrl: "https://mn.gov/pfa/financing-programs/water-infrastructure/",
        sourceRecordId: "mn-pfa-srf",
        badges: ["live_bid"],
        metadata: { srfPortal: true },
      },
    ];
    if (lastErr) {
      return texas;
    }
    return texas;
  }
  return leads;
}
