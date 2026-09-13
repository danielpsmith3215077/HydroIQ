import { NextResponse } from "next/server";
import { createSession, ensureAdmin, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await ensureAdmin();
    const body = (await req.json()) as { password?: string; username?: string };
    const password = body.password;
    if (!password) {
      return NextResponse.json({ error: "Enter the site password." }, { status: 400 });
    }
    const user = await verifyPassword(password);
    if (!user) {
      return NextResponse.json(
        { error: "Wrong password. Use AUTH_PASSWORD from Vercel Environment Variables." },
        { status: 401 },
      );
    }
    await createSession({
      userId: user.id,
      orgId: user.organizationId,
      username: user.username,
      displayName: user.displayName,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[login] failed", err);
    return NextResponse.json(
      { error: "Database not ready. Confirm DATABASE_URL (Supabase URI) and that tables exist." },
      { status: 503 },
    );
  }
}
