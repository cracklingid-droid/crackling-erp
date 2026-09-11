import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { buildAttendanceGroups, type AttendanceMapping } from "@/lib/attendance-parse";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const body = await req.json();
  const rows: string[][] = Array.isArray(body.rows) ? body.rows : [];
  const headerRowIndex = Number(body.headerRowIndex ?? 0);
  const mapping: AttendanceMapping | undefined = body.mapping;
  if (rows.length === 0 || !mapping) {
    return NextResponse.json({ error: "Data absensi atau pemetaan kolom tidak lengkap" }, { status: 400 });
  }

  const { groups, skipped, totalRows } = buildAttendanceGroups(rows, headerRowIndex, mapping);

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
