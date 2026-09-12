"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ClipboardList, Gauge, LogOut, Menu, Radio, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

type Note = { id: string; title: string; body: string; createdAt: string; leadId: string | null };

const NAV = [
  { href: "/", label: "Lead feed", icon: Radio },
  { href: "/forecasts", label: "Forecasts", icon: Gauge },
  { href: "/pipeline", label: "Contacted", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  children,
  displayName,
  unread,
}: {
  children: React.ReactNode;
  displayName: string;
  unread: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [badge, setBadge] = useState(unread);

  async function openBell() {
    const next = !bellOpen;
    setBellOpen(next);
    if (next) {
      const res = await fetch("/api/notifications");
      const json = await res.json();
      setNotes(json.notifications ?? []);
      await fetch("/api/notifications", { method: "POST" });
      setBadge(0);
      router.refresh();
    }
  }

  useEffect(() => {
    setBadge(unread);
  }, [unread]);

  return (
    <div className="min-h-dvh bg-sand">
      <header className="sticky top-0 z-40 border-b border-navy/10 bg-navy text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button className="rounded-md p-2 md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-serif text-2xl tracking-tight">HydroIQ</span>
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60 sm:inline">
              AMFS Filtration
            </span>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white",
                  pathname === item.href && "bg-white/15 text-white",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={openBell} aria-label="Notifications">
                <Bell size={20} />
                {badge > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold">
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </Button>
              {bellOpen ? (
                <div className="absolute right-0 mt-2 w-[min(92vw,24rem)] overflow-hidden rounded-xl border border-navy/10 bg-white text-navy shadow-xl">
                  <div className="border-b border-navy/10 px-4 py-3 text-sm font-semibold">New leads</div>
                  <div className="max-h-96 overflow-y-auto">
                    {notes.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-navy/60">No new notifications. The badge clears when you open this panel.</p>
                    ) : (
                      notes.map((n) => (
                        <Link
                          key={n.id}
                          href={n.leadId ? `/leads/${n.leadId}` : "/"}
                          onClick={() => setBellOpen(false)}
                          className="block border-b border-navy/5 px-4 py-3 hover:bg-sand"
                        >
                          <div className="text-sm font-semibold">{n.title}</div>
                          <div className="line-clamp-2 text-xs text-navy/60">{n.body}</div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <span className="hidden text-xs text-white/60 sm:inline">{displayName}</span>
            <form action="/api/auth/logout" method="post">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" aria-label="Sign out">
                <LogOut size={18} />
              </Button>
            </form>
          </div>
        </div>
        {open ? (
          <nav className="border-t border-white/10 px-4 py-2 md:hidden">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-2 py-3 text-sm font-medium text-white/90"
              >
                <item.icon size={16} /> {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 md:pb-10">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-navy/10 bg-white/95 backdrop-blur md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-navy/50",
              pathname === item.href && "text-teal-800",
            )}
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
