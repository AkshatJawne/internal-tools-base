// DEV ONLY session: a signed cookie holding a seeded user id.
// Replace this module with OIDC (Entra ID / Okta) in production; nothing else needs to change.
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { getSecret } from "@/kit/secrets";

const COOKIE = "itb_session";
const secret = () => getSecret("SESSION_SECRET"); // throws in production if unset; never falls back to the dev value
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");

export async function createSession(userId: string) {
  const value = `${userId}.${Date.now()}`;
  (await cookies()).set(COOKIE, `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
}

export async function readSessionUserId(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const i = raw.lastIndexOf(".");
  const value = raw.slice(0, i);
  const sig = Buffer.from(raw.slice(i + 1));
  const expected = Buffer.from(sign(value));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  return value.split(".")[0] ?? null;
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}
