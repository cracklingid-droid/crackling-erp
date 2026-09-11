import { toLocalDateString } from "./date-utils";

// Siklus absensi default Crackling: tanggal 21 s.d. tanggal 20 bulan
// berikutnya, gajian tanggal 25 (permintaan Kevin 2026-09-11). Ini cuma
// SARAN AWAL saat bikin periode/lihat rekap - tanggalnya tetap bisa diubah
// bebas (Kevin sempat minta contoh 21 bulan lalu s.d. 24 bulan ini utk
// penyesuaian sementara).
export function getDefaultPeriodRange(reference: Date = new Date()): { start: Date; end: Date } {
  const day = reference.getDate();
  const startMonth = day < 21 ? reference.getMonth() - 1 : reference.getMonth();
  const start = new Date(reference.getFullYear(), startMonth, 21);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 20);
  return { start, end };
}

export function toDateInputValue(d: Date): string {
  return toLocalDateString(d);
}
