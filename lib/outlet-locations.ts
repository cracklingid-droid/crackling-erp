// Titik lokasi (lat/lng) + radius toleransi tiap outlet - dipakai validasi
// absen mandiri selfie+lokasi di Portal Karyawan (blokir total kalau HP
// karyawan di luar radius saat absen). Permintaan Kevin 2026-09-17.
//
// !!! KOORDINAT DI BAWAH INI MASIH PLACEHOLDER (BELUM DIISI KEVIN) !!!
// Ganti value lat/lng tiap outlet dengan titik asli sebelum fitur ini
// dipakai di lapangan - selama masih placeholder, absen dari lokasi asli
// outlet kemungkinan besar akan DITOLAK (dianggap di luar radius) karena
// titiknya belum tepat. Key HARUS persis sama dengan Employee.outlet
// (termasuk "Kantor" utk karyawan kantor - lihat lib/payroll-config.ts).
export type OutletLocation = { lat: number; lng: number; radiusMeters: number };

const DEFAULT_RADIUS_METERS = 50; // keputusan Kevin 2026-09-17

export const OUTLET_LOCATIONS: Record<string, OutletLocation> = {
  "Joglo (Central Kitchen)": { lat: -6.2, lng: 106.78, radiusMeters: DEFAULT_RADIUS_METERS },
  "Gading Serpong": { lat: -6.2422, lng: 106.628, radiusMeters: DEFAULT_RADIUS_METERS },
  "Kelapa Gading": { lat: -6.1588, lng: 106.9056, radiusMeters: DEFAULT_RADIUS_METERS },
  Fatgai: { lat: -6.19, lng: 106.82, radiusMeters: DEFAULT_RADIUS_METERS },
  Kantor: { lat: -6.2, lng: 106.78, radiusMeters: DEFAULT_RADIUS_METERS },
};

export function getOutletLocation(outlet: string | null): OutletLocation | null {
  if (!outlet) return null;
  return OUTLET_LOCATIONS[outlet] ?? null;
}
