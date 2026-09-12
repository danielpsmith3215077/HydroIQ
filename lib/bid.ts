import { prisma } from "./prisma";
import { AMFS } from "./constants";
import type { BidComparable } from "@prisma/client";

export type BidInputs = {
  flowGpd?: number;
  durationDays?: number;
  contaminant?: string;
  proposedBid?: number;
};

export type BidSuggestion = {
  low: number;
  high: number;
  historicalMin: number;
  historicalMax: number;
  warning: string | null;
  note: string;
  comparables: Array<{
    id: string;
    title: string;
    recipient: string | null;
    awardAmount: number;
    state: string | null;
    sourceUrl: string;
    awardedAt: Date | null;
  }>;
};

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - i) + sorted[hi] * (i - lo);
}

function engineeringRange(flowGpd: number, durationDays: number) {
  const gallons = flowGpd * durationDays;
  const trailerDays = Math.max(1, Math.ceil(gallons / AMFS.capacityGpd));
  return {
    low: trailerDays * 12_000,
    high: trailerDays * 28_000,
    trailerDays,
  };
}

export async function suggestBidRange(organizationId: string, inputs: BidInputs): Promise<BidSuggestion> {
  const rows = await prisma.bidComparable.findMany({
    where: { organizationId },
    orderBy: { awardAmount: "asc" },
  });

  const contaminant = (inputs.contaminant ?? "").toLowerCase();
  const waterish = rows.filter((r) => {
    const hay = `${r.title} ${r.keywords} ${r.description} ${r.naics ?? ""}`.toLowerCase();
    if (r.awardAmount < 25_000 || r.awardAmount > 2_500_000) return false;
    if (contaminant && hay.includes(contaminant)) return true;
    return /water|filtr|remediat|pfas|wastewater|leachate|562910|221310/.test(hay);
  });

  const eng =
    inputs.flowGpd && inputs.durationDays
      ? engineeringRange(inputs.flowGpd, inputs.durationDays)
      : null;

  const band = waterish.filter((r) => {
    if (!eng) return true;
    return r.awardAmount >= eng.low * 0.25 && r.awardAmount <= eng.high * 6;
  });
  const pool: BidComparable[] = band.length ? band : waterish;
  const amounts = pool.map((r) => r.awardAmount).sort((a, b) => a - b);

  let low = 75_000;
  let high = 450_000;
  if (eng) {
    low = eng.low;
    high = eng.high;
    if (amounts.length >= 3) {
      const p25 = percentile(amounts, 0.25);
      const p75 = percentile(amounts, 0.75);
      low = Math.round((eng.low + p25) / 2);
      high = Math.round((eng.high + p75) / 2);
    }
  } else if (amounts.length) {
    low = percentile(amounts, 0.25);
    high = percentile(amounts, 0.75);
  }

  const historicalMin = amounts[0] ?? low;
  const historicalMax = amounts[amounts.length - 1] ?? high;

  let warning: string | null = null;
  if (inputs.proposedBid && high && inputs.proposedBid > Math.max(high, historicalMax) * 1.02) {
    warning = "⚠️ Bid Exceeds Historical Maximum — Highly likely to lose on price";
  } else if (inputs.proposedBid && high && inputs.proposedBid > high) {
    warning = "⚠️ Bid Exceeds suggested high — check the comparable awards before you submit.";
  }

  return {
    low: Math.round(low),
    high: Math.round(high),
    historicalMin: Math.round(historicalMin),
    historicalMax: Math.round(historicalMax),
    warning,
    note: eng
      ? `Advisory range from AMFS trailer throughput (${eng.trailerDays} trailer-day${eng.trailerDays === 1 ? "" : "s"} at up to ${AMFS.capacityGpd.toLocaleString()} gpd) blended with federal awards in a similar dollar band. Not a guaranteed win number.`
      : "Advisory range from comparable federal water/remediation awards under $2.5M. Not a guaranteed win number. Enter flow and duration for a trailer-day estimate.",
    comparables: pool.slice(-12).reverse().map((r) => ({
      id: r.id,
      title: r.title,
      recipient: r.recipient,
      awardAmount: r.awardAmount,
      state: r.state,
      sourceUrl: r.sourceUrl,
      awardedAt: r.awardedAt,
    })),
  };
}
