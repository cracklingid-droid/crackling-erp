import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

// Data lengkap utk halaman Rincian Perhitungan (dipelajari dari sheet
// "Hitungan" Kevin): per karyawan, ringkasan komponen gaji + rincian harian
// (jadwal, jam masuk/pulang dari absensi, catatan kejadian per tanggal).
// Endpoint terpisah dari GET periode biasa spy payload periode/slip yang
// sering dipakai tetap ringan. Permintaan Kevin 2026-09-11.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

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
              workSchedule: true,
            },
          },
        },
        orderBy: { employee: { name: "asc" } },
      },
      eventNotes: { orderBy: { date: "asc" } },
    },
  });
  if (!period) return NextResponse.json({ error: "Periode tidak ditemukan" }, { status: 404 });

  const employeeIds = period.items.map((it) => it.employeeId);
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: { employeeId: { in: employeeIds }, date: { gte: period.startDate, lte: period.endDate } },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ ...period, attendanceRecords });
}
