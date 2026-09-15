import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHrWriteUser } from "@/lib/hr-access";
import { buildAttendanceGroups, type AttendanceGroup, type AttendanceMapping } from "@/lib/attendance-parse";
import { recalcOverlappingOutletPeriods } from "@/lib/attendance-recalc";
import { findAttendanceIssues } from "@/lib/attendance-issues";
import { normalizeName } from "@/lib/attendance-name-match";

export async function POST(req: Request) {
  const { error } = await requireHrWriteUser();
  if (error) return error;

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

  const dates = groups.map((g) => new Date(g.date));
  const times = dates.map((d) => d.getTime());
  const minDate = dates.length > 0 ? new Date(Math.min(...times)) : null;
  const maxDate = dates.length > 0 ? new Date(Math.max(...times)) : null;

  // Absen yang sudah dikoreksi manual HR (halaman Absen Perlu Dicek) tidak
  // ditimpa lagi oleh file mesin - kalau tidak, upload ulang file yang sama
  // bakal mengembalikan scan tunggal & masalahnya muncul lagi. Permintaan
  // 2026-09-15.
  const manualKeys = new Set<string>();
  if (minDate && maxDate) {
    const manualRecords = await prisma.attendanceRecord.findMany({
      where: { manualAt: { not: null }, date: { gte: minDate, lte: maxDate } },
      select: { employeeId: true, date: true },
    });
    for (const r of manualRecords) manualKeys.add(`${r.employeeId}|${r.date.toISOString().slice(0, 10)}`);
  }

  const unmatched = new Set<string>();
  let imported = 0;
  let keptManual = 0;

  for (const g of groups) {
    const normalizedName = normalizeName(g.employeeName);
    const employeeId = byName.get(normalizedName) ?? aliasByName.get(normalizedName);
    if (!employeeId) {
      unmatched.add(g.employeeName);
      continue;
    }
    const date = new Date(g.date);
    if (manualKeys.has(`${employeeId}|${date.toISOString().slice(0, 10)}`)) {
      keptManual++;
      continue;
    }
    await prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId, date } },
      update: { clockIn: g.clockIn, clockOut: g.clockOut },
      create: { employeeId, date, clockIn: g.clockIn, clockOut: g.clockOut },
    });
    imported++;
  }

  const recalculatedPeriods = imported > 0 ? await recalcOverlappingOutletPeriods(dates) : [];

  // Langsung kasih tahu HR berapa absen bermasalah (lupa tap in/out, tidak
  // absen menurut Roster) di rentang tanggal file ini - permintaan 2026-09-15.
  const issueCount = minDate && maxDate ? (await findAttendanceIssues(minDate, maxDate)).length : 0;

  return NextResponse.json({
    totalRows,
    skippedRows: skipped,
    groupsFound: groups.length,
    imported,
    keptManual,
    unmatchedNames: Array.from(unmatched),
    recalculatedPeriods,
    issueCount,
    issueRangeStart: minDate ? minDate.toISOString().slice(0, 10) : null,
    issueRangeEnd: maxDate ? maxDate.toISOString().slice(0, 10) : null,
  });
}
