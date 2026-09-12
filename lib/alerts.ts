import { prisma } from "./prisma";

/**
 * Alerts go to the builder, never to the AMFS operator.
 * The operator only sees last-good data plus a calm "sources delayed" note.
 */
export async function alertMaintainer(source: string, message: string, extra?: string) {
  const body = [
    `HydroIQ source failure: ${source}`,
    message,
    extra ?? "",
    `Time: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  console.error(`[hydroiq:alert] ${source}: ${message}${extra ? `\n${extra}` : ""}`);

  const email = process.env.MAINTAINER_EMAIL;
  const key = process.env.RESEND_API_KEY;
  if (email && key) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM ?? "HydroIQ Alerts <onboarding@resend.dev>",
          to: [email],
          subject: `[HydroIQ] ${source} ingestion failed`,
          text: body,
        }),
      });
    } catch (err) {
      console.error("[hydroiq:alert] resend failed", err);
    }
  }
}

export async function recordRun(input: {
  organizationId: string;
  source: string;
  status: "success" | "empty" | "error";
  recordsFound: number;
  recordsCreated: number;
  error?: string | null;
  startedAt: Date;
}) {
  return prisma.sourceRun.create({
    data: {
      ...input,
      finishedAt: new Date(),
    },
  });
}
