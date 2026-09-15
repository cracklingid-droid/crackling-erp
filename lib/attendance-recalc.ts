import { prisma } from "./db";
import { recalcOutletPeriod } from "./payroll-outlet-recalc";

// Begitu absensi berubah (upload file ATAU koreksi manual HR di halaman
// Absen Perlu Dicek), langsung hitung ulang gaji Outlet utk periode (draft)
// manapun yang tanggalnya kena rentang absensi ini - supaya HR tidak perlu
// ingat urutan "upload absen dulu baru bikin periode" atau takut lupa update
// manual. Periode yang sudah "final" TIDAK disentuh (gaji yang sudah
// difinalisasi/dibayar tidak boleh berubah sendiri). Cuma memperbarui baris
// karyawan yang SUDAH ada di periode itu (tidak menambah baris baru utk
// karyawan yang belum ada saat periode dibuat). Keputusan Kevin 2026-09-12;
// dipindah dari app/api/payroll/attendance/import/route.ts 2026-09-15 supaya
// dipakai bersama alur absen manual.
export async function recalcOverlappingOutletPeriods(dates: Date[]): Promise<string[]> {
  if (dates.length === 0) return [];
  const times = dates.map((d) => d.getTime());
  const minDate = new Date(Math.min(...times));
  const maxDate = new Date(Math.max(...times));

  const periods = await prisma.payrollPeriod.findMany({
    where: { category: "outlet", status: "draft", startDate: { lte: maxDate }, endDate: { gte: minDate } },
    select: { id: true, label: true },
  });

  for (const period of periods) {
    await recalcOutletPeriod(period.id);
  }
  return periods.map((p) => p.label);
}
