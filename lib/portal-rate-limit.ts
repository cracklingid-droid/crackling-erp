import { prisma } from "./db";

// Rate limiting login Portal Karyawan - lihat komentar model
// PortalLoginAttempt di schema.prisma utk alasannya. Batas dipilih longgar
// spy karyawan asli yang salah ketik beberapa kali tidak keblokir, tapi
// cukup ketat utk menutup brute force otomatis. Permintaan Kevin
// 2026-09-18 (bagian dari audit keamanan menyeluruh).
const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS_PER_CODE = 5; // per ID Karyawan yang sama
const MAX_ATTEMPTS_PER_IP = 20; // per IP, lintas ID Karyawan (cegah enumerasi)

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function checkPortalLoginRateLimit(
  employeeCode: string,
  ip: string
): Promise<{ allowed: true } | { allowed: false; retryAfterMinutes: number }> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const [byCode, byIp] = await Promise.all([
    prisma.portalLoginAttempt.count({ where: { employeeCode, createdAt: { gte: since } } }),
    prisma.portalLoginAttempt.count({ where: { ip, createdAt: { gte: since } } }),
  ]);
  if (byCode >= MAX_ATTEMPTS_PER_CODE || byIp >= MAX_ATTEMPTS_PER_IP) {
    return { allowed: false, retryAfterMinutes: WINDOW_MINUTES };
  }
  return { allowed: true };
}

export async function recordFailedPortalLogin(employeeCode: string, ip: string): Promise<void> {
  await prisma.portalLoginAttempt.create({ data: { employeeCode, ip } });
  // Bersihkan baris lama sekalian (opportunistic, tidak perlu cron
  // terpisah) - tabel ini cuma dipakai sbg jendela geser 15 menit.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.portalLoginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } });
}

export async function clearPortalLoginAttempts(employeeCode: string): Promise<void> {
  await prisma.portalLoginAttempt.deleteMany({ where: { employeeCode } });
}
