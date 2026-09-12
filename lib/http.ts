export class SourceError extends Error {
  constructor(
    message: string,
    readonly source: string,
    readonly causeErr?: unknown,
  ) {
    super(message);
    this.name = "SourceError";
  }
}

export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 28000, ...rest } = init;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...rest,
      signal: ctrl.signal,
      headers: {
        accept: "application/json",
        "user-agent": "HydroIQ/1.0 (AMFS Filtration internal lead tool)",
        ...(rest.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText} ${body.slice(0, 240)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchText(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ status: number; text: string; url: string }> {
  const { timeoutMs = 28000, ...rest } = init;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...rest,
      signal: ctrl.signal,
      headers: {
        "user-agent": "HydroIQ/1.0 (AMFS Filtration internal lead tool)",
        ...(rest.headers ?? {}),
      },
      cache: "no-store",
    });
    const text = await res.text();
    return { status: res.status, text, url: res.url };
  } finally {
    clearTimeout(t);
  }
}
