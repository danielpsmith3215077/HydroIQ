"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Textarea, Input, Label } from "./ui/input";
import type { Lead } from "@prisma/client";

export function EmailPanel({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [subject, setSubject] = useState(lead.emailSubject);
  const [body, setBody] = useState(lead.emailBody);
  const [saving, setSaving] = useState(false);
  const contacted = lead.status === "contacted";

  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  async function markSent() {
    setSaving(true);
    await fetch(`/api/leads/${lead.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "mark_sent", subject, body }),
    });
    setSaving(false);
    router.refresh();
  }

  async function saveDraft() {
    setSaving(true);
    await fetch(`/api/leads/${lead.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save_draft", subject, body }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-navy/10 bg-white p-4 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl text-navy">Outreach draft</h2>
          <p className="mt-1 text-sm text-navy/60">
            Nothing sends from HydroIQ. Edit the AMFS template, open it in Mail, then mark it sent so it leaves the live queue.
          </p>
        </div>
        {contacted ? (
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-800">
            Contacted {lead.emailSentAt ? new Date(lead.emailSentAt).toLocaleString() : ""}
          </span>
        ) : null}
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={contacted} />
        </div>
        <div>
          <Label htmlFor="body">Email</Label>
          <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} disabled={contacted} />
        </div>
      </div>
      {!contacted ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="teal">
            <a href={mailto}>Open in Mail</a>
          </Button>
          <Button variant="outline" onClick={saveDraft} disabled={saving}>
            Save edits
          </Button>
          <Button onClick={markSent} disabled={saving}>
            Mark as sent
          </Button>
        </div>
      ) : null}
    </section>
  );
}
