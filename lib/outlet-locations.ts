import { prisma } from "./db";
import { OUTLET_NAMES } from "./payroll-config";

// Titik lokasi (lat/lng) + radius toleransi tiap outlet - dipakai validasi
// absen mandiri selfie+lokasi di Portal Karyawan (blokir total kalau HP
// karyawan di luar radius saat absen). Diatur HR lewat halaman
// /hr/payroll/absensi/lokasi (model Prisma OutletLocation), BUKAN hardcode -
// dulu sempat hardcode placeholder di file ini, sekarang HR isi sendiri
// pakai GPS HP saat berdiri di lokasi outletnya. Permintaan Kevin
// 2026-09-17.
export type OutletLocation = { lat: number; lng: number; radiusMeters: number };

// Semua outlet yang butuh titik lokasi absensi - 4 outlet resto (Joglo, GS,
// KG, Fatgai dari lib/payroll-config.ts) + "Kantor" (karyawan non-outlet).
// Key HARUS persis sama dgn Employee.outlet.
export const ATTENDANCE_OUTLETS = [...OUTLET_NAMES, "Kantor"];

export async function getOutletLocation(outlet: string | null): Promise<OutletLocation | null> {
  if (!outlet) return null;
  const row = await prisma.outletLocation.findUnique({ where: { outlet } });
  if (!row) return null;
  return { lat: row.lat, lng: row.lng, radiusMeters: row.radiusMeters };
}
