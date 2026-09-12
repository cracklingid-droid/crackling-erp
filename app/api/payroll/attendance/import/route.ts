import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { buildAttendanceGroups, type AttendanceGroup, type AttendanceMapping } from "@/lib/attendance-parse";
import { employeeCategory } from "@/lib/payroll-config";
import { computeOutletPayrollFields } from "@/lib/payroll-outlet-calc";
import { computeAttendanceSummaries } from "@/lib/attendance-summary";

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

  const employees = await prisma.employee.findMany({ select: { id: true, name: true } });
  const byName = new Map(employees.map((e) => [e.name.trim().toLowerCase(), e.id]));

  const unmatched = new Set<string>();
  let imported = 0;

  for (const g of groups) {
    const employeeId = byName.get(g.employeeName.trim().toLowerCase());
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
    include: { items: { select: { id: true, employeeId: true } } },
  });
  if (periods.length === 0) return [];

  const employees = await prisma.employee.findMany({ where: { status: "active" } });
  const byId = new Map(employees.map((e) => [e.id, e]));

  for (const period of periods) {
    const employeeIds = period.items.map((it) => it.employeeId);
    const summaries = await computeAttendanceSummaries(employeeIds, period.startDate, period.endDate);
    for (const item of period.items) {
      const emp = byId.get(item.employeeId);
      if (!emp || employeeCategory(emp.outlet) !== "outlet") continue;
      const { daysPresent, overtimeMinutes } = summaries.get(item.employeeId) ?? { daysPresent: 0, overtimeMinutes: 0 };
      await prisma.payrollItem.update({
        where: { id: item.id },
        data: computeOutletPayrollFields(emp, daysPresent, overtimeMinutes),
      });
    }
  }
  return periods.map((p) => p.label);
}
