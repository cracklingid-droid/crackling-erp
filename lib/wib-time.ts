// WIB = UTC+7, tanpa DST. Konvensi penyimpanan jam absensi di seluruh sistem
// (lihat lib/attendance-parse.ts, lib/attendance-summary.ts): komponen
// JAM/MENIT yang disimpan di kolom DateTime (Postgres timestamptz, dibaca
// balik lewat getUTCHours/getUTCMinutes) mewakili jam dinding WIB LANGSUNG,
// BUKAN instant UTC yang benar - jadi jangan pakai new Date()/toISOString()
// biasa yang membaca kembali zona waktu server, harus lewat helper ini.
const WIB_OFFSET_MIN = 7 * 60;

// Date yang komponen UTC-nya = jam dinding WIB saat ini - dipakai isi
// AttendanceRecord.clockIn/clockOut dari absen mandiri Portal Karyawan.
export function wibNowAsStoredDate(): Date {
  return new Date(Date.now() + WIB_OFFSET_MIN * 60000);
}

// Tengah malam (tanpa jam) WIB hari ini - dipakai kolom AttendanceRecord.date.
export function wibTodayDateOnly(): Date {
  const wib = wibNowAsStoredDate();
  return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()));
}

// "HH:MM" dari Date yang disimpan dgn konvensi di atas.
export function formatStoredTimeWib(d: Date): string {
  return d.toISOString().slice(11, 16);
}
