"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * On an empty feed, pull a fast bootstrap ingest (priority ECHO states + AMLIS)
 * so leads appear within ~1 minute. Then kick a full national sweep in the background.
 */
export function AutoIngest({ empty }: { empty: boolean }) {
  const started = useRef(false);
  const router = useRouter();
  useEffect(() => {
    if (!empty || started.current) return;
    started.current = true;
    let cancelled = false;
    const poll = window.setInterval(() => {
      if (!cancelled) router.refresh();
    }, 8000);

    (async () => {
      try {
        const res = await fetch("/api/ingest?mode=bootstrap", { method: "POST" });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          console.error("[auto-ingest]", j.error || res.statusText);
        }
      } catch (err) {
        console.error("[auto-ingest]", err);
      } finally {
        if (!cancelled) router.refresh();
        // Full national pull continues after bootstrap; do not block the UI.
        void fetch("/api/ingest?mode=full", { method: "POST", keepalive: true }).catch(() => undefined);
        window.setTimeout(() => window.clearInterval(poll), 2000);
      }
    })();

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [empty, router]);
  return null;
}
