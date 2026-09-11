import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { buildAttendanceGroups, type AttendanceGroup, type AttendanceMapping } from "@/lib/attendance-parse";

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

  return NextResponse.json({
    totalRows,
    skippedRows: skipped,
    groupsFound: groups.length,
    imported,
    unmatchedNames: Array.from(unmatched),
  });
}
