import { SOURCE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const VARIANT_STYLES: Record<string, string> = {
  live_violation: "border-red-200 bg-red-50 text-red-800",
  live_bid: "border-red-200 bg-red-50 text-red-800",
  predictive: "border-violet-200 bg-violet-50 text-violet-900",
  subcontract: "border-sky-200 bg-sky-50 text-sky-900",
};

const VARIANT_COPY: Record<string, string> = {
  live_violation: "🔴 Live Violation",
  live_bid: "🔴 Live Bid",
  predictive: "🔮 Predictive: Upcoming RFP",
  subcontract: "🤝 Subcontract Opportunity",
};

export function VariantBadge({ variant }: { variant: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide",
        VARIANT_STYLES[variant] ?? "border-navy/10 bg-sand text-navy",
      )}
    >
      {VARIANT_COPY[variant] ?? variant}
    </span>
  );
}

export function SourceBadge({ source }: { source: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-navy/10 bg-sand px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-navy/70">
      {SOURCE_LABELS[source] ?? source}
    </span>
  );
}
