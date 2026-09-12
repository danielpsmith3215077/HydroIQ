"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/utils";
import type { BidSuggestion } from "@/lib/bid";
import { Button } from "./ui/button";
import { Input, Label } from "./ui/input";

export function BidPanel({
  leadId,
  suggestedValue,
}: {
  leadId: string;
  suggestedValue: number | null;
}) {
  const [flow, setFlow] = useState("50000");
  const [days, setDays] = useState("30");
  const [contaminant, setContaminant] = useState("");
  const [proposed, setProposed] = useState(suggestedValue ? String(Math.round(suggestedValue)) : "");
  const [result, setResult] = useState<BidSuggestion | null>(null);
  const [openComps, setOpenComps] = useState(false);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    const res = await fetch("/api/bid", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        leadId,
        flowGpd: Number(flow) || undefined,
        durationDays: Number(days) || undefined,
        contaminant,
        proposedBid: Number(proposed) || undefined,
      }),
    });
    setResult(await res.json());
    setLoading(false);
  }

  const max = result ? Math.max(result.high * 1.4, result.historicalMax || 0, Number(proposed) || 0) : 0;
  const pct = useMemo(() => {
    if (!result || !max) return 50;
    const v = Number(proposed) || result.low;
    return Math.min(100, Math.max(0, (v / max) * 100));
  }, [proposed, result, max]);

  return (
    <section className="rounded-2xl border border-navy/10 bg-white p-4 shadow-sm md:p-6">
      <h2 className="font-serif text-2xl text-navy">Bid range suggestion</h2>
      <p className="mt-1 text-sm text-navy/60">
        Advisory only. Built from comparable federal awards plus trailer throughput — not a guaranteed win number.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <Label>Flow (gallons / day)</Label>
          <Input type="number" inputMode="numeric" value={flow} onChange={(e) => setFlow(e.target.value)} />
        </div>
        <div>
          <Label>Duration (days)</Label>
          <Input type="number" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        </div>
        <div>
          <Label>Contaminant class</Label>
          <Input value={contaminant} onChange={(e) => setContaminant(e.target.value)} placeholder="PFAS, lead, leachate…" />
        </div>
      </div>
      <div className="mt-3">
        <Label>Your intended bid (USD)</Label>
        <Input type="number" inputMode="decimal" value={proposed} onChange={(e) => setProposed(e.target.value)} />
      </div>
      <Button className="mt-4" variant="teal" onClick={run} disabled={loading}>
        {loading ? "Calculating…" : "Suggest range"}
      </Button>
      {result ? (
        <div className="mt-5 space-y-3">
          <div className="relative h-3 rounded-full bg-sand">
            <div className="absolute inset-y-0 rounded-full bg-teal-700/30" style={{ left: `${(result.low / max) * 100}%`, width: `${((result.high - result.low) / max) * 100}%` }} />
            <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-navy bg-white" style={{ left: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-sm font-semibold text-navy">
            <span>Low {formatMoney(result.low)}</span>
            <span>High {formatMoney(result.high)}</span>
          </div>
          <p className="text-xs text-navy/55">{result.note}</p>
          {result.warning ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
              {result.warning}
            </div>
          ) : null}
          <button className="text-sm font-semibold text-teal-800 underline" onClick={() => setOpenComps((v) => !v)}>
            {openComps ? "Hide" : "Show"} comparable awards used
          </button>
          {openComps ? (
            <ul className="divide-y divide-navy/10 rounded-xl border border-navy/10">
              {result.comparables.length === 0 ? (
                <li className="px-3 py-3 text-sm text-navy/60">No award history stored yet. Run a source refresh to pull USAspending comparables.</li>
              ) : (
                result.comparables.map((c) => (
                  <li key={c.id} className="px-3 py-3 text-sm">
                    <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-navy hover:underline">
                      {c.title}
                    </a>
                    <div className="text-navy/60">
                      {c.recipient} · {c.state} · {formatMoney(c.awardAmount)}
                    </div>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
