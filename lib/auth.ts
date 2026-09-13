import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { ORG_SLUG, SESSION_COOKIE } from "./constants";

export const COOKIE = SESSION_COOKIE;
const THIRTY_DAYS = 60 * 60 * 24 * 30;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export type Session = {
  userId: string;
  orgId: string;
  username: string;
  displayName: string;
};

export async function createSession(session: Session) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${THIRTY_DAYS}s`)
    .sign(secret());

  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.userId || !payload.orgId || !payload.username) return null;
    return {
      userId: String(payload.userId),
      orgId: String(payload.orgId),
      username: String(payload.username),
      displayName: String(payload.displayName ?? payload.username),
    };
  } catch {
    return null;
  }
}

export function clearSession() {
  cookies().set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function verifyPassword(password: string) {
  const username = (process.env.AUTH_USERNAME ?? "amfs").trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  return user;
}

/** @deprecated use verifyPassword — kept for scripts */
export async function verifyLogin(username: string, password: string) {
  const expected = (process.env.AUTH_USERNAME ?? "amfs").trim().toLowerCase();
  if (username.trim().toLowerCase() !== expected) return null;
  return verifyPassword(password);
}

export async function ensureAdmin() {
  const username = (process.env.AUTH_USERNAME ?? "amfs").trim().toLowerCase();
  const password = process.env.AUTH_PASSWORD ?? "HydroIQ2026";
  const hash = await bcrypt.hash(password, 10);

  let org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        slug: ORG_SLUG,
        name: "AMFS Filtration",
        settings: { create: {} },
      },
    });
  } else if (!(await prisma.orgSettings.findUnique({ where: { organizationId: org.id } }))) {
    await prisma.orgSettings.create({ data: { organizationId: org.id } });
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (!existing) {
    await prisma.user.create({
      data: {
        organizationId: org.id,
        username,
        passwordHash: hash,
        displayName: "AMFS Admin",
      },
    });
  } else {
    // Keep DB password in sync with AUTH_PASSWORD so Vercel env changes always work.
    const matches = await bcrypt.compare(password, existing.passwordHash);
    if (!matches) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash: hash },
      });
    }
  }
  return org;
}
