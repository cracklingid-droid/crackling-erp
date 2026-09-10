import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// Session sederhana (HMAC-signed cookie), sama pola dgn Crackling Warehouse
// tapi cookie & secret sendiri - akun HR harus benar-benar terpisah dari
// akun Warehouse (keputusan Kevin 2026-09-10).

const SECRET = process.env.SESSION_SECRET || "dev-only-secret-change-me";
const COOKIE_NAME = "crackling_erp_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 hari

export type SessionPayload = {
  userId: number;
  username: string;
  name: string;
  exp: number;
};

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">): string {
  const full: SessionPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS };
  const data = Buffer.from(JSON.stringify(full)).toString("base64url");
  const sig = sign(data);
  return `${data}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = sign(data);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload: SessionPayload = JSON.parse(Buffer.from(data, "base64url").toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(COOKIE_NAME)?.value);
}

export { COOKIE_NAME, MAX_AGE_SECONDS };
