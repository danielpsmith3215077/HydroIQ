"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";

export function RefreshSources({ empty }: { empty: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const mode = empty ? "bootstrap" : "full";
      const res = await fetch(`/api/ingest?mode=${mode}`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j.error || "Refresh failed");
      }
      if (empty) {
        // Continue national coverage after the feed has something to show.
        void fetch("/api/ingest?mode=full", { method: "POST", keepalive: true }).catch(() => undefined);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <Button onClick={run} disabled={busy} variant="teal">
        {busy ? "Pulling public records…" : empty ? "Load live leads" : "Refresh sources"}
      </Button>
      {busy ? (
        <p className="max-w-xs text-right text-xs text-navy/55">
          {empty
            ? "Pulling EPA ECHO for priority states first — the feed should fill within about a minute."
            : "EPA ECHO can take a minute. The feed fills in as each source lands — this is a live pull, not a sample file."}
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
