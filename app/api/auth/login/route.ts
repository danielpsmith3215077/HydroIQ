import { NextResponse } from "next/server";
import { createSession, loginWithSitePassword } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { password?: string };
    const session = await loginWithSitePassword(body.password ?? "");
    await createSession(session);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err ? Number((err as { status: number }).status) : 500;
    if (status === 400 || status === 401) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Wrong password." },
        { status },
      );
    }
    console.error("[login] failed", err);
    return NextResponse.json({ error: "Login failed. Try again." }, { status: 500 });
  }
}
