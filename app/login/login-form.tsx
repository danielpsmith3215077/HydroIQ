"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("amfs");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      setError("That username or password did not match.");
      setBusy(false);
      return;
    }
    router.push(params.get("next") || "/");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-navy px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-sand p-6 shadow-2xl md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-800">AMFS Filtration</p>
        <h1 className="mt-2 font-serif text-4xl text-navy">HydroIQ</h1>
        <p className="mt-2 text-sm leading-relaxed text-navy/70">
          Internal lead intelligence for mobile nanofiltration. One admin. Stays signed in for 30 days.
        </p>
        <form className="mt-6 space-y-3" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="username">Username</Label>
            <Input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <Button className="w-full" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Open the lead feed"}
          </Button>
        </form>
      </div>
    </div>
  );
}
