import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { buildEmailDraft } from "../email-draft";
import { scoreLead } from "../scoring";
import type { DraftLead } from "../types";

function isUniqueViolation(err: unknown) {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

export async function upsertLeads(
  organizationId: string,
  drafts: DraftLead[],
  opts: { quiet?: boolean; createOnly?: boolean } = {},
) {
  if (!drafts.length) return { created: 0, updated: 0 };

  let created = 0;
  let updated = 0;

  // One read for the whole batch instead of findUnique-per-row (pooler round-trips dominate).
  const bySource = new Map<string, DraftLead[]>();
  for (const d of drafts) {
    const list = bySource.get(d.source) ?? [];
    list.push(d);
    bySource.set(d.source, list);
  }

  for (const [source, sourceDrafts] of bySource) {
    const ids = sourceDrafts.map((d) => d.sourceRecordId);
    const existingRows = await prisma.lead.findMany({
      where: { organizationId, source, sourceRecordId: { in: ids } },
      select: {
        id: true,
        sourceRecordId: true,
        status: true,
        emailSentAt: true,
        emailSubject: true,
        emailBody: true,
      },
    });
    const existingMap = new Map(existingRows.map((r) => [r.sourceRecordId, r]));

    const toCreate: Prisma.LeadCreateManyInput[] = [];
    const notifications: { title: string; body: string; sourceRecordId: string }[] = [];

    for (const draft of sourceDrafts) {
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

      const existing = existingMap.get(draft.sourceRecordId);
      if (existing) {
        if (opts.createOnly) {
          updated += 1;
          continue;
        }
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
        toCreate.push({
          organizationId,
          sourceRecordId: draft.sourceRecordId,
          ...data,
          emailSubject: email.subject,
          emailBody: email.body,
          unread: true,
          status: "new",
        });
        notifications.push({
          title: draft.facilityName,
          body: `${draft.badges[0] ?? "New lead"} · ${draft.state} · ${draft.summary.slice(0, 140)}`,
          sourceRecordId: draft.sourceRecordId,
        });
      }
    }

    if (toCreate.length) {
      try {
        const result = await prisma.lead.createMany({ data: toCreate, skipDuplicates: true });
        created += result.count;
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        // Fall back row-by-row on rare conflict storms.
        for (const row of toCreate) {
          try {
            await prisma.lead.create({ data: row });
            created += 1;
          } catch (inner) {
            if (!isUniqueViolation(inner)) throw inner;
            updated += 1;
          }
        }
      }

      if (!opts.quiet && notifications.length) {
        const createdRows = await prisma.lead.findMany({
          where: {
            organizationId,
            source,
            sourceRecordId: { in: notifications.map((n) => n.sourceRecordId) },
          },
          select: { id: true, sourceRecordId: true },
        });
        const idByRecord = new Map(createdRows.map((r) => [r.sourceRecordId, r.id]));
        const notifData = notifications
          .map((n) => {
            const leadId = idByRecord.get(n.sourceRecordId);
            if (!leadId) return null;
            return {
              organizationId,
              leadId,
              title: n.title,
              body: n.body,
            };
          })
          .filter(Boolean) as { organizationId: string; leadId: string; title: string; body: string }[];
        if (notifData.length) {
          await prisma.notification.createMany({ data: notifData });
        }
      }
    }
  }

  return { created, updated };
}

export function echoFacilityUrl(registryId: string | null | undefined, fallbackId?: string) {
  if (registryId) return `https://echo.epa.gov/detailed-facility-report?fid=${encodeURIComponent(registryId)}`;
  if (fallbackId) return `https://echo.epa.gov/detailed-facility-report?fid=${encodeURIComponent(fallbackId)}`;
  return "https://echo.epa.gov/";
}
