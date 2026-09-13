import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { withDb } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  let unread = 0;
  try {
    unread = await withDb((db) =>
      db.notification.count({
        where: { organizationId: session.orgId, readAt: null },
      }),
    );
  } catch (err) {
    console.error("[layout] notification count failed", err);
  }

  return (
    <AppShell displayName={session.displayName} unread={unread}>
      {children}
    </AppShell>
  );
}
