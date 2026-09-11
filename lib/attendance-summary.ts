import { prisma } from "./db";

export type AttendanceSummary = { daysPresent: number; overtimeMinutes: number; totalMinutes: number; lateCount: number };

// Jadwal kerja standar karyawan (field Employee.workSchedule, mis.
// "08:00-20:00") - dipakai utk bandingkan jam masuk aktual vs jadwal, jadi
// tahu berapa kali terlambat. Employee tanpa jadwal diisi = tidak dihitung
// (bukan 0 kali, tapi memang tidak ada acuan).
function parseScheduleStart(workSchedule: string | null | undefined): { h: number; m: number } | null {
  if (!workSchedule) return null;
  const m = workSchedule.match(/^\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

// Hitung ringkasan absensi (hari hadir, total jam kerja, jam lembur,
// jumlah kali terlambat) per karyawan dalam satu rentang tanggal - dipakai
// baik saat generate periode gaji maupun di halaman Rekap Absensi. Lembur =
// kelebihan dari 8 jam/hari (simplifikasi, lihat catatan di
// lib/payroll-config.ts). Parameter `schedules` opsional - kalau diisi,
// lateCount dihitung dari jam masuk aktual vs jadwal (Employee.workSchedule)
// per karyawan; kalau tidak diisi (mis. dipanggil dari alur Payroll Outlet
// yang sudah punya potongan telat manual sendiri), lateCount selalu 0.
// Permintaan Kevin 2026-09-11.
export async function computeAttendanceSummaries(
  employeeIds: number[],
  start: Date,
  end: Date,
  schedules?: Map<number, string | null>
): Promise<Map<number, AttendanceSummary>> {
  const map = new Map<number, AttendanceSummary>();
  for (const id of employeeIds) map.set(id, { daysPresent: 0, overtimeMinutes: 0, totalMinutes: 0, lateCount: 0 });
  if (employeeIds.length === 0) return map;

  const records = await prisma.attendanceRecord.findMany({
    where: { employeeId: { in: employeeIds }, date: { gte: start, lte: end } },
  });

  for (const r of records) {
    const s = map.get(r.employeeId);
    if (!s) continue;
    s.daysPresent++;
    if (r.clockIn && r.clockOut) {
      const worked = (r.clockOut.getTime() - r.clockIn.getTime()) / 60000;
      s.totalMinutes += worked;
      s.overtimeMinutes += Math.max(0, Math.round(worked - 8 * 60));
    }
    if (r.clockIn && schedules) {
      const sched = parseScheduleStart(schedules.get(r.employeeId));
      if (sched) {
        const clockMinutes = r.clockIn.getUTCHours() * 60 + r.clockIn.getUTCMinutes();
        if (clockMinutes > sched.h * 60 + sched.m) s.lateCount++;
      }
    }
  }
  return map;
}
