import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// Session Portal Karyawan - pola sama dgn lib/session.ts (HR) tapi cookie &
// payload sendiri, karena akun karyawan HARUS terpisah dari akun HrUser
// (beda hak akses total: karyawan cuma lihat datanya sendiri). Permintaan
// Kevin 2026-09-12.

const SECRET = process.env.SESSION_SECRET || "dev-only-secret-change-me";
const COOKIE_NAME = "crackling_erp_employee_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 hari - portal info doang, bukan alat kerja HR

export type EmployeeSessionPayload = {
  employeeId: number;
  employeeCode: string;
  name: string;
  exp: number;
};

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(`employee:${data}`).digest("base64url");
}

export function createEmployeeSessionToken(payload: Omit<EmployeeSessionPayload, "exp">): string {
  const full: EmployeeSessionPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS };
  const data = Buffer.from(JSON.stringify(full)).toString("base64url");
  const sig = sign(data);
  return `${data}.${sig}`;
}

export function verifyEmployeeSessionToken(token: string | undefined | null): EmployeeSessionPayload | null {
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
    const payload: EmployeeSessionPayload = JSON.parse(Buffer.from(data, "base64url").toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getEmployeeSession(): Promise<EmployeeSessionPayload | null> {
  const store = await cookies();
  return verifyEmployeeSessionToken(store.get(COOKIE_NAME)?.value);
}

export { COOKIE_NAME, MAX_AGE_SECONDS };
