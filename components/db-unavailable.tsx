export function DbUnavailable({ detail }: { detail?: string }) {
  return (
    <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-12 text-center">
      <h2 className="font-serif text-2xl text-navy">Database briefly unavailable</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-navy/65">
        You are signed in. Postgres did not answer this request. Refresh in a moment — source data is retained when
        the connection recovers.
      </p>
      {detail ? <p className="mt-3 text-xs text-navy/45">{detail}</p> : null}
    </div>
  );
}
