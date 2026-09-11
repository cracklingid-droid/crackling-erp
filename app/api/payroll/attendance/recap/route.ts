import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { computeAttendanceSummaries } from "@/lib/attendance-summary";

// Rekap absensi per karyawan dalam 1 rentang tanggal - laporan lihat-saja,
// terpisah dari proses hitung gaji, supaya HR bisa cek data absensi dulu
// (mis. ketahuan ada karyawan yang absennya 0 sebelum bikin periode gaji).
// Permintaan Kevin 2026-09-11.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

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
    select: { id: true, name: true, position: true, outlet: true, workSchedule: true },
    orderBy: { name: "asc" },
  });
  const schedules = new Map(employees.map((e) => [e.id, e.workSchedule]));
  const summaries = await computeAttendanceSummaries(employees.map((e) => e.id), start, end, schedules);

  const result = employees.map((e) => ({
    ...e,
    ...(summaries.get(e.id) ?? { daysPresent: 0, overtimeMinutes: 0, totalMinutes: 0, lateCount: 0 }),
  }));

  return NextResponse.json(result);
}
