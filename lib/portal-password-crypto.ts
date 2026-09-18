import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// Password Portal Karyawan yang sudah diganti sendiri oleh karyawan
// disimpan di sini terenkripsi (AES-256-GCM), BUKAN sbg hash satu arah -
// keputusan sadar spy HR bisa mendekripsi & memberi tahu karyawan yang
// lupa (lihat komentar Employee.portalPasswordEnc di schema.prisma).
// Permintaan Kevin 2026-09-18.
const KEY = scryptSync(process.env.SESSION_SECRET || "dev-only-secret-change-me", "portal-password-v1", 32);

export function encryptPortalPassword(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptPortalPassword(stored: string): string | null {
  try {
    const [ivB64, tagB64, dataB64] = stored.split(":");
    const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}
