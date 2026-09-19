import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHrWriteUser } from "@/lib/hr-access";
import { computeAttendanceSummaries } from "@/lib/attendance-summary";
import { formatStoredTimeWib } from "@/lib/wib-time";

// Rekap absensi per karyawan dalam 1 rentang tanggal - laporan lihat-saja,
// terpisah dari proses hitung gaji, supaya HR bisa cek data absensi dulu
// (mis. ketahuan ada karyawan yang absennya 0 sebelum bikin periode gaji).
// Permintaan Kevin 2026-09-11.
export async function GET(req: Request) {
  const { error } = await requireHrWriteUser();
  if (error) return error;

  const url = new URL(req.url);
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");
  if (!startParam || !endParam) {
    return NextResponse.json({ error: "Rentang tanggal wajib diisi" }, { status: 400 });
  }
  const start = new Date(startParam);
  const end = new Date(endParam);

  const employees = await prisma.employee.findMany({
    where: { status: "active" },
    select: { id: true, name: true, position: true, outlet: true, scheduleStart: true },
    orderBy: { name: "asc" },
  });
  const schedules = new Map(employees.map((e) => [e.id, e.scheduleStart]));
  const summaries = await computeAttendanceSummaries(employees.map((e) => e.id), start, end, schedules);

  // Filter 1 hari (Dari = Sampai): sertakan jam datang & jam pulang per
  // karyawan. Rentang lebih dari 1 hari tetap ringkasan saja (field ini
  // tidak dikirim). Permintaan Kevin 2026-09-19.
  const isDaily = startParam === endParam;
  const timesByEmployee = new Map<number, { clockInTime: string | null; clockOutTime: string | null }>();
  if (isDaily) {
    const records = await prisma.attendanceRecord.findMany({
      where: { employeeId: { in: employees.map((e) => e.id) }, date: { gte: start, lte: end } },
      select: { employeeId: true, clockIn: true, clockOut: true },
    });
    for (const r of records) {
      timesByEmployee.set(r.employeeId, {
        clockInTime: r.clockIn ? formatStoredTimeWib(r.clockIn) : null,
        clockOutTime: r.clockOut ? formatStoredTimeWib(r.clockOut) : null,
      });
    }
  }

  const result = employees.map((e) => ({
    ...e,
    ...(summaries.get(e.id) ?? { daysPresent: 0, overtimeMinutes: 0, totalMinutes: 0, lateCount: 0, incompleteClockInCount: 0, incompleteClockOutCount: 0 }),
    ...(isDaily ? (timesByEmployee.get(e.id) ?? { clockInTime: null, clockOutTime: null }) : {}),
  }));

  return NextResponse.json(result);
}
