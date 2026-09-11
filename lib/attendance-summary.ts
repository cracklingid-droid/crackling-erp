import { prisma } from "./db";

export type AttendanceSummary = { daysPresent: number; overtimeMinutes: number; totalMinutes: number };

// Hitung ringkasan absensi (hari hadir, total jam kerja, jam lembur) per
// karyawan dalam satu rentang tanggal - dipakai baik saat generate periode
// gaji maupun di halaman Rekap Absensi. Lembur = kelebihan dari 8 jam/hari
// (simplifikasi, lihat catatan di lib/payroll-config.ts).
export async function computeAttendanceSummaries(
  employeeIds: number[],
  start: Date,
  end: Date
): Promise<Map<number, AttendanceSummary>> {
  const map = new Map<number, AttendanceSummary>();
  for (const id of employeeIds) map.set(id, { daysPresent: 0, overtimeMinutes: 0, totalMinutes: 0 });
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
  }
  return map;
}
