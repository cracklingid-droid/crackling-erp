// Jadwal interview berulang tiap hari kerja (Senin-Sabtu), 13.30-16.00 WIB
// tiap 15 menit (permintaan Kevin 2026-09-10). WIB = UTC+7, tanpa DST, jadi
// offset tetap dipakai langsung tanpa library timezone.
const WIB_OFFSET_MIN = 7 * 60;
const SLOT_START_MIN = 13 * 60 + 30; // 13.30
const SLOT_END_MIN = 16 * 60; // 16.00
const STEP_MIN = 15;
const MIN_LEAD_MIN = 60; // slot hari ini minimal 1 jam dari sekarang

function slotTimesOfDay(): number[] {
  const out: number[] = [];
  for (let m = SLOT_START_MIN; m <= SLOT_END_MIN; m += STEP_MIN) out.push(m);
  return out;
}

function isWorkingDay(y: number, m: number, d: number) {
  const dow = new Date(Date.UTC(y, m, d)).getUTCDay(); // 0=Minggu..6=Sabtu
  return dow !== 0; // Senin-Sabtu
}

function slotDateTimeUTC(y: number, m: number, d: number, minutesOfDay: number): Date {
  return new Date(Date.UTC(y, m, d, 0, minutesOfDay) - WIB_OFFSET_MIN * 60000);
}

function wibNow() {
  const now = new Date();
  const wib = new Date(now.getTime() + WIB_OFFSET_MIN * 60000);
  return {
    y: wib.getUTCFullYear(),
    m: wib.getUTCMonth(),
    d: wib.getUTCDate(),
    minutesOfDay: wib.getUTCHours() * 60 + wib.getUTCMinutes(),
  };
}

export function generateCandidateSlots(daysAhead = 14): Date[] {
  const now = wibNow();
  const slots: Date[] = [];
  let cursor = new Date(Date.UTC(now.y, now.m, now.d));
  for (let i = 0; i < daysAhead; i++) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();
    const d = cursor.getUTCDate();
    if (isWorkingDay(y, m, d)) {
      for (const minutesOfDay of slotTimesOfDay()) {
        if (i === 0 && minutesOfDay <= now.minutesOfDay + MIN_LEAD_MIN) continue;
        slots.push(slotDateTimeUTC(y, m, d, minutesOfDay));
      }
    }
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return slots;
}

export function formatSlotWIB(date: Date): { tanggal: string; jam: string } {
  const wib = new Date(date.getTime() + WIB_OFFSET_MIN * 60000);
  const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][wib.getUTCDay()];
  const bulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ][wib.getUTCMonth()];
  const tanggal = `${hari}, ${wib.getUTCDate()} ${bulan} ${wib.getUTCFullYear()}`;
  const jam = `${String(wib.getUTCHours()).padStart(2, "0")}.${String(wib.getUTCMinutes()).padStart(2, "0")} WIB`;
  return { tanggal, jam };
}
