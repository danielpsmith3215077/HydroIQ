"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function AutoIngest({ empty }: { empty: boolean }) {
  const started = useRef(false);
  const router = useRouter();
  useEffect(() => {
    if (!empty || started.current) return;
    started.current = true;
    fetch("/api/ingest", { method: "POST" })
      .catch(() => undefined)
      .finally(() => router.refresh());
  }, [empty, router]);
  return null;
}
