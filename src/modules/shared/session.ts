// Sessiya: jose bilan imzolangan JWT, httpOnly cookie'da saqlanadi.
// Edge runtime'da ham ishlaydi (proxy.ts shu faylni ishlatadi).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "gsr_session";
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 soat

export type SessionPayload = {
  sub: string; // user id
  username: string;
  fullName: string;
  perms: string[]; // huquq kodlari
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifySession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, getSecret());
    return {
      sub: payload.sub!,
      username: payload.username,
      fullName: payload.fullName,
      perms: payload.perms ?? [],
    };
  } catch {
    return null;
  }
}
