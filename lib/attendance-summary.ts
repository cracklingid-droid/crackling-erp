import { prisma } from "./db";

export type AttendanceSummary = {
  daysPresent: number;
  overtimeMinutes: number;
  totalMinutes: number;
  lateCount: number;
  // "Absen Tidak Lengkap Clock In/Out" (khusus Payroll Kantor, permintaan
  // Kevin 2026-09-13) - hari hadir tapi salah satu jam scan tidak tercatat.
  incompleteClockInCount: number;
  incompleteClockOutCount: number;
};

// Jadwal kerja standar karyawan (field Employee.scheduleStart, format
// terstruktur "HH:MM" dari <input type="time">) - dipakai utk bandingkan jam
// masuk aktual vs jadwal, jadi tahu berapa kali terlambat. Employee tanpa
// jadwal diisi = tidak dihitung (bukan 0 kali, tapi memang tidak ada acuan).
function parseScheduleStart(scheduleStart: string | null | undefined): { h: number; m: number } | null {
  if (!scheduleStart) return null;
  const m = scheduleStart.match(/^\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

// Hitung ringkasan absensi (hari hadir, total jam kerja, jumlah kali
// terlambat) per karyawan dalam satu rentang tanggal - dipakai baik saat
// generate periode gaji maupun di halaman Rekap Absensi.
//
// overtimeMinutes SENGAJA SELALU 0 (bukan dihapus dari tipe - biar tidak
// bongkar ulang semua pemanggil) - dulu dihitung "kelebihan dari 8 jam/hari"
// tapi itu SALAH TOTAL utk shift resto Crackling yang memang 12 jam tetap
// (outlet 10:00-22:00, Joglo 08:00-20:00): setiap shift normal otomatis
// kehitung "lembur 4 jam", ditambah lagi kalau karyawan clock-in lebih awal
// cuma numpang wifi (bukan benar-benar mulai kerja lebih awal). Keputusan
// Kevin 2026-09-14: TIDAK ADA penghitungan lembur otomatis dari jam
// clock-in/out sama sekali, utk semua kategori (Outlet & Kantor) - kalau
// nanti ada lembur beneran, dicatat manual oleh HR (mis. berdasar Pengajuan
// Lembur SPV yang sudah disetujui), bukan diturunkan dari data absensi.
// Parameter `schedules` opsional - kalau diisi,
// lateCount dihitung dari jam masuk aktual vs jadwal (Employee.scheduleStart)
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
  for (const id of employeeIds)
    map.set(id, { daysPresent: 0, overtimeMinutes: 0, totalMinutes: 0, lateCount: 0, incompleteClockInCount: 0, incompleteClockOutCount: 0 });
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
    }
    if (!r.clockIn) s.incompleteClockInCount++;
    if (!r.clockOut) s.incompleteClockOutCount++;
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
