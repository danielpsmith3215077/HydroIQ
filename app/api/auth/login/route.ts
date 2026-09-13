import { NextResponse } from "next/server";
import { createSession, ensureAdmin, verifyLogin } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await ensureAdmin();
  } catch (err) {
    console.error("[login] ensureAdmin failed", err);
    return NextResponse.json(
      { error: "Database not ready. Confirm DATABASE_URL and that Supabase tables exist." },
      { status: 503 },
    );
  }
  const { username, password } = (await req.json()) as { username?: string; password?: string };
  if (!username || !password) {
    return NextResponse.json({ error: "Enter username and password." }, { status: 400 });
  }
  const user = await verifyLogin(username, password);
  if (!user) {
    return NextResponse.json(
      { error: "Invalid username or password. Use AUTH_USERNAME / AUTH_PASSWORD from Vercel." },
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
}
