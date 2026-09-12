import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ensureAdmin, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await ensureAdmin();
  const session = await getSession();
  if (!session) redirect("/login");
  const unread = await prisma.notification.count({
    where: { organizationId: session.orgId, readAt: null },
  });
  return (
    <AppShell displayName={session.displayName} unread={unread}>
      {children}
    </AppShell>
  );
}
