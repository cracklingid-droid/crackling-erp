import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHrReadUser, canViewCategory } from "@/lib/hr-access";

// Data lengkap utk halaman Rincian Perhitungan (dipelajari dari sheet
// "Hitungan" Kevin): per karyawan, ringkasan komponen gaji + rincian harian
// (jadwal, jam masuk/pulang dari absensi, catatan kejadian per tanggal).
// Endpoint terpisah dari GET periode biasa spy payload periode/slip yang
// sering dipakai tetap ringan. Permintaan Kevin 2026-09-11.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireHrReadUser();
  if (error) return error;

  const { id } = await ctx.params;
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: Number(id) },
    include: {
      items: {
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              position: true,
              outlet: true,
              baseSalary: true,
              dailyTransportRate: true,
              dailyMealRate: true,
              dailyBaseRate: true,
              scheduleStart: true,
              scheduleEnd: true,
            },
          },
        },
        orderBy: { employee: { name: "asc" } },
      },
      eventNotes: { orderBy: { date: "asc" } },
    },
  });
  if (!period) return NextResponse.json({ error: "Periode tidak ditemukan" }, { status: 404 });
  if (!canViewCategory(user, period.category)) {
    return NextResponse.json({ error: "Tidak punya akses ke periode ini" }, { status: 403 });
  }

  const employeeIds = period.items.map((it) => it.employeeId);
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: { employeeId: { in: employeeIds }, date: { gte: period.startDate, lte: period.endDate } },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ ...period, attendanceRecords });
}
