import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { buildAttendanceGroups, type AttendanceGroup, type AttendanceMapping } from "@/lib/attendance-parse";
import { recalcOutletPeriod } from "@/lib/payroll-outlet-recalc";
import { normalizeName } from "@/lib/attendance-name-match";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const body = await req.json();

  // Laporan mesin absensi sudah diparse jadi groups siap-pakai di endpoint
  // parse (lib/attendance-machine-report.ts) - HR cuma perlu cek preview lalu
  // kirim langsung ke sini, tanpa lewat pemetaan kolom manual. Permintaan
  // Kevin 2026-09-11.
  const providedGroups: AttendanceGroup[] | undefined = Array.isArray(body.groups) ? body.groups : undefined;

  let groups: AttendanceGroup[];
  let skipped = 0;
  let totalRows = 0;

  if (providedGroups) {
    groups = providedGroups.map((g) => ({ ...g, clockIn: new Date(g.clockIn), clockOut: new Date(g.clockOut) }));
    totalRows = groups.length;
  } else {
    const rows: string[][] = Array.isArray(body.rows) ? body.rows : [];
    const headerRowIndex = Number(body.headerRowIndex ?? 0);
    const mapping: AttendanceMapping | undefined = body.mapping;
    if (rows.length === 0 || !mapping) {
      return NextResponse.json({ error: "Data absensi atau pemetaan kolom tidak lengkap" }, { status: 400 });
    }
    const built = buildAttendanceGroups(rows, headerRowIndex, mapping);
    groups = built.groups;
    skipped = built.skipped;
    totalRows = built.totalRows;
  }

  const [employees, aliases] = await Promise.all([
    prisma.employee.findMany({ select: { id: true, name: true } }),
    prisma.attendanceNameAlias.findMany({ select: { machineName: true, employeeId: true } }),
  ]);
  const byName = new Map(employees.map((e) => [normalizeName(e.name), e.id]));
  // Nama yang sudah pernah dikonfirmasi HR (mis. "ahmad" -> Ahmad Yani) di
  // upload sebelumnya - dicocokkan juga di sini, bukan cuma di preview,
  // supaya jalur upload lain (mis. format spreadsheet umum yang belum
  // punya preview fuzzy-match) tetap kebagian manfaatnya. Permintaan Kevin
  // 2026-09-12.
  const aliasByName = new Map(aliases.map((a) => [a.machineName, a.employeeId]));

  const unmatched = new Set<string>();
  let imported = 0;

  for (const g of groups) {
    const normalizedName = normalizeName(g.employeeName);
    const employeeId = byName.get(normalizedName) ?? aliasByName.get(normalizedName);
    if (!employeeId) {
      unmatched.add(g.employeeName);
      continue;
    }
    await prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId, date: new Date(g.date) } },
      update: { clockIn: g.clockIn, clockOut: g.clockOut },
      create: { employeeId, date: new Date(g.date), clockIn: g.clockIn, clockOut: g.clockOut },
    });
    imported++;
  }

  const recalculatedPeriods = imported > 0 ? await recalcOverlappingOutletPeriods(groups) : [];

  return NextResponse.json({
    totalRows,
    skippedRows: skipped,
    groupsFound: groups.length,
    imported,
    unmatchedNames: Array.from(unmatched),
    recalculatedPeriods,
  });
}

// Begitu absensi diupload, langsung hitung ulang gaji Outlet utk periode
// (draft) manapun yang tanggalnya kena rentang absensi ini - supaya HR
// tidak perlu ingat urutan "upload absen dulu baru bikin periode" atau
// takut lupa update manual. Periode yang sudah "final" TIDAK disentuh
// (gaji yang sudah difinalisasi/dibayar tidak boleh berubah sendiri).
// Cuma memperbarui baris karyawan yang SUDAH ada di periode itu (tidak
// menambah baris baru utk karyawan yang belum ada saat periode dibuat).
// Keputusan Kevin 2026-09-12.
async function recalcOverlappingOutletPeriods(groups: AttendanceGroup[]): Promise<string[]> {
  const dates = groups.map((g) => new Date(g.date).getTime());
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));

  const periods = await prisma.payrollPeriod.findMany({
    where: { category: "outlet", status: "draft", startDate: { lte: maxDate }, endDate: { gte: minDate } },
    select: { id: true, label: true },
  });

  for (const period of periods) {
    await recalcOutletPeriod(period.id);
  }
  return periods.map((p) => p.label);
}
