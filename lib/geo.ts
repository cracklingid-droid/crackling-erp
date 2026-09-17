// Jarak antara 2 titik koordinat (meter), rumus Haversine - dipakai utk
// validasi absen mandiri Portal Karyawan (lokasi HP karyawan vs titik lokasi
// outlet). Cukup akurat utk radius ratusan meter, tidak perlu presisi
// geodesic yang lebih rumit. Permintaan Kevin 2026-09-17.
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // radius bumi, meter
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
