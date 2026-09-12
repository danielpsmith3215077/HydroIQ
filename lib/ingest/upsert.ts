import { prisma } from "../prisma";
import { buildEmailDraft } from "../email-draft";
import { scoreLead } from "../scoring";
import type { DraftLead } from "../types";

export async function upsertLeads(organizationId: string, drafts: DraftLead[]) {
  let created = 0;
  let updated = 0;

  for (const draft of drafts) {
    const email = buildEmailDraft(draft);
    const score = scoreLead(draft);
    const data = {
      source: draft.source,
      variant: draft.variant,
      facilityName: draft.facilityName,
      city: draft.city ?? null,
      county: draft.county ?? null,
      state: draft.state,
      address: draft.address ?? null,
      zip: draft.zip ?? null,
      latitude: draft.latitude ?? null,
      longitude: draft.longitude ?? null,
      summary: draft.summary,
      detail: draft.detail,
      contaminantClass: draft.contaminantClass ?? null,
      violationType: draft.violationType ?? null,
      fineAmount: draft.fineAmount ?? null,
      contractType: draft.contractType ?? null,
      estimatedValue: draft.estimatedValue ?? null,
      sourceRecordUrl: draft.sourceRecordUrl,
      registryId: draft.registryId ?? null,
      permitId: draft.permitId ?? null,
      eventDate: draft.eventDate ?? null,
      forecastWindow: draft.forecastWindow ?? null,
      primeContractor: draft.primeContractor ?? null,
      complianceHistory: draft.complianceHistory ?? null,
      flowMgd: draft.flowMgd ?? null,
      badgesJson: JSON.stringify(draft.badges),
      metadataJson: JSON.stringify(draft.metadata ?? {}),
      score,
    };

    const existing = await prisma.lead.findUnique({
      where: {
        organizationId_source_sourceRecordId: {
          organizationId,
          source: draft.source,
          sourceRecordId: draft.sourceRecordId,
        },
      },
    });

    if (existing) {
      const keepDraft = existing.status === "contacted" || Boolean(existing.emailSentAt);
      await prisma.lead.update({
        where: { id: existing.id },
        data: {
          ...data,
          emailSubject: keepDraft ? existing.emailSubject : email.subject,
          emailBody: keepDraft ? existing.emailBody : email.body,
        },
      });
      updated += 1;
    } else {
      const lead = await prisma.lead.create({
        data: {
          organizationId,
          sourceRecordId: draft.sourceRecordId,
          ...data,
          emailSubject: email.subject,
          emailBody: email.body,
          unread: true,
          status: "new",
        },
      });
      await prisma.notification.create({
        data: {
          organizationId,
          leadId: lead.id,
          title: draft.facilityName,
          body: `${draft.badges[0] ?? "New lead"} · ${draft.state} · ${draft.summary.slice(0, 140)}`,
        },
      });
      created += 1;
    }
  }

  return { created, updated };
}

export function echoFacilityUrl(registryId: string | null | undefined, fallbackId?: string) {
  if (registryId) return `https://echo.epa.gov/detailed-facility-report?fid=${encodeURIComponent(registryId)}`;
  if (fallbackId) return `https://echo.epa.gov/detailed-facility-report?fid=${encodeURIComponent(fallbackId)}`;
  return "https://echo.epa.gov/";
}
