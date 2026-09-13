import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { withDb } from "./prisma";
import { ORG_SLUG, SESSION_COOKIE } from "./constants";

export const COOKIE = SESSION_COOKIE;
const THIRTY_DAYS = 60 * 60 * 24 * 30;

/** Stable single-tenant IDs when the DB is briefly unreachable at login time. */
export const BOOTSTRAP_ORG_ID = process.env.BOOTSTRAP_ORG_ID ?? "cmu02vity00008ksh0yxxhewk";
export const BOOTSTRAP_USER_ID = process.env.BOOTSTRAP_USER_ID ?? "cmu02vjer00038kshidw8ckvr";

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

export function expectedPassword() {
  return process.env.AUTH_PASSWORD ?? "HydroIQ2026";
}

export function expectedUsername() {
  return (process.env.AUTH_USERNAME ?? "amfs").trim().toLowerCase();
}

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
  const username = expectedUsername();
  return withDb(async (db) => {
    const user = await db.user.findUnique({ where: { username } });
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return user;
  });
}

/** @deprecated use verifyPassword — kept for scripts */
export async function verifyLogin(username: string, password: string) {
  if (username.trim().toLowerCase() !== expectedUsername()) return null;
  return verifyPassword(password);
}

export async function ensureAdmin() {
  const username = expectedUsername();
  const password = expectedPassword();

  return withDb(async (db) => {
    let org = await db.organization.findUnique({ where: { slug: ORG_SLUG } });
    if (!org) {
      org = await db.organization.create({
        data: {
          slug: ORG_SLUG,
          name: "AMFS Filtration",
          settings: { create: {} },
        },
      });
    } else if (!(await db.orgSettings.findUnique({ where: { organizationId: org.id } }))) {
      await db.orgSettings.create({ data: { organizationId: org.id } });
    }

    const existing = await db.user.findUnique({ where: { username } });
    if (!existing) {
      const hash = await bcrypt.hash(password, 10);
      await db.user.create({
        data: {
          organizationId: org.id,
          username,
          passwordHash: hash,
          displayName: "AMFS Admin",
        },
      });
    } else {
      const matches = await bcrypt.compare(password, existing.passwordHash);
      if (!matches) {
        const hash = await bcrypt.hash(password, 10);
        await db.user.update({
          where: { id: existing.id },
          data: { passwordHash: hash },
        });
      }
    }
    return org;
  });
}

/**
 * Password-only site gate. Prefer live DB user/org IDs; if Postgres is briefly
 * unreachable from Vercel, still issue a session with bootstrap IDs so the UI loads.
 */
export async function loginWithSitePassword(password: string): Promise<Session> {
  if (!password) {
    throw Object.assign(new Error("Enter the site password."), { status: 400 });
  }
  if (password !== expectedPassword()) {
    throw Object.assign(new Error("Wrong password."), { status: 401 });
  }

  try {
    const org = await ensureAdmin();
    const user = await withDb((db) =>
      db.user.findUnique({ where: { username: expectedUsername() } }),
    );
    if (!user) {
      throw Object.assign(new Error("Wrong password."), { status: 401 });
    }
    await withDb((db) =>
      db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    ).catch(() => undefined);

    return {
      userId: user.id,
      orgId: org.id,
      username: user.username,
      displayName: user.displayName,
    };
  } catch (err) {
    const status = err && typeof err === "object" && "status" in err ? Number((err as { status: number }).status) : 0;
    if (status === 400 || status === 401) throw err;

    // DB unreachable — still unlock the site for the correct password.
    console.error("[login] DB unavailable; issuing bootstrap session", err);
    return {
      userId: BOOTSTRAP_USER_ID,
      orgId: BOOTSTRAP_ORG_ID,
      username: expectedUsername(),
      displayName: "AMFS Admin",
    };
  }
}
