import { NextResponse } from "next/server";
import { createSession, ensureAdmin, verifyLogin } from "@/lib/auth";

export async function POST(req: Request) {
  await ensureAdmin();
  const { username, password } = (await req.json()) as { username?: string; password?: string };
  if (!username || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }
  const user = await verifyLogin(username, password);
  if (!user) return NextResponse.json({ error: "Invalid" }, { status: 401 });
  await createSession({
    userId: user.id,
    orgId: user.organizationId,
    username: user.username,
    displayName: user.displayName,
  });
  return NextResponse.json({ ok: true });
}
