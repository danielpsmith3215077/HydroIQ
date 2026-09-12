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

export async function suggestBidRange(organizationId: string, inputs: BidInputs): Promise<BidSuggestion> {
  const rows = await prisma.bidComparable.findMany({
    where: { organizationId },
    orderBy: { awardAmount: "asc" },
  });

  const contaminant = (inputs.contaminant ?? "").toLowerCase();
  const filtered = rows.filter((r) => {
    if (!contaminant) return true;
    const hay = `${r.title} ${r.keywords} ${r.description}`.toLowerCase();
    return hay.includes(contaminant) || hay.includes("water") || hay.includes("remediat");
  });
  const pool: BidComparable[] = filtered.length >= 4 ? filtered : rows;
  const amounts = pool.map((r) => r.awardAmount).filter((n) => n > 10_000 && n < 500_000_000);

  let low = percentile(amounts, 0.25);
  let high = percentile(amounts, 0.75);
  const historicalMin = amounts[0] ?? 0;
  const historicalMax = amounts[amounts.length - 1] ?? 0;

  if (inputs.flowGpd && inputs.durationDays) {
    const gallons = inputs.flowGpd * inputs.durationDays;
    const trailerDays = Math.ceil(gallons / AMFS.capacityGpd);
    const dayRateLow = 12_000;
    const dayRateHigh = 28_000;
    const engLow = trailerDays * dayRateLow;
    const engHigh = trailerDays * dayRateHigh;
    if (amounts.length) {
      low = Math.round((low + engLow) / 2);
      high = Math.round((high + engHigh) / 2);
    } else {
      low = engLow;
      high = engHigh;
    }
  }

  if (!amounts.length && !inputs.flowGpd) {
    low = 75_000;
    high = 450_000;
  }

  let warning: string | null = null;
  if (inputs.proposedBid && high && inputs.proposedBid > high * 1.05) {
    warning =
      "⚠️ Bid Exceeds Historical Maximum — Highly likely to lose on price";
    if (historicalMax && inputs.proposedBid > historicalMax) {
      warning =
        "⚠️ Bid Exceeds Historical Maximum — Highly likely to lose on price";
    }
  }

  return {
    low: Math.round(low),
    high: Math.round(high),
    historicalMin: Math.round(historicalMin),
    historicalMax: Math.round(historicalMax),
    warning,
    note: "Data-informed estimate from comparable federal awards and AMFS trailer throughput — not a guaranteed win number. Open the comparables list before you hang a price on it.",
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
