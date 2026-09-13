import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { employeeCategory } from "@/lib/payroll-config";
import { computeAttendanceSummaries } from "@/lib/attendance-summary";
import { createNextOutletPeriod } from "@/lib/payroll-outlet-auto";
import { computeKantorPayrollFields } from "@/lib/payroll-kantor-calc";
import { requireHrReadUser, requireHrWriteUser, canViewCategory } from "@/lib/hr-access";

export async function GET(req: Request) {
  const { user, error } = await requireHrReadUser();
  if (error) return error;

  const requested = new URL(req.url).searchParams.get("category");
  // "manager" cuma boleh lihat Payroll Outlet (view-only, permintaan Kevin
  // 2026-09-13) - kategori "kantor" ditolak, kategori kosong dipaksa outlet.
  if (requested === "kantor" && !canViewCategory(user, "kantor")) {
    return NextResponse.json({ error: "Tidak punya akses ke Payroll Kantor" }, { status: 403 });
  }
  const category = requested ?? (canViewCategory(user, "kantor") ? null : "outlet");

  const periods = await prisma.payrollPeriod.findMany({
    where: category ? { category } : undefined,
    include: { _count: { select: { items: true } } },
    orderBy: { startDate: "desc" },
  });
  return NextResponse.json(periods);
}

// Buat periode gaji baru + otomatis generate baris PayrollItem utk semua
// karyawan aktif di kategori ini, dgn saran awal (gaji pokok, uang makan,
// lembur, BPJS) dari data yang ada - tetap bisa diedit HR satu-satu
// sebelum periode difinalisasi. Permintaan Kevin 2026-09-11.
export async function POST(req: Request) {
  const { user, error } = await requireHrWriteUser();
  if (error) return error;

  const body = await req.json();
  const category = body.category === "outlet" || body.category === "kantor" ? body.category : null;
  if (!category) return NextResponse.json({ error: "Kategori wajib diisi" }, { status: 400 });

  // Rentang tanggal & label Payroll Outlet TIDAK BISA dikustomisasi lagi -
  // dihitung sendiri oleh server dari periode outlet terakhir, mengikuti
  // jadwal tetap yang sudah diumumkan Kevin ke grup (lib/payroll-outlet-
  // auto.ts, dipakai bersama dgn cron /api/cron/create-outlet-period).
  // Keputusan Kevin 2026-09-12.
  if (category === "outlet") {
    const result = await createNextOutletPeriod(user.id);
    if (!result.created) return NextResponse.json({ error: result.reason }, { status: 400 });
    return NextResponse.json(result.period, { status: 201 });
  }

  const label = typeof body.label === "string" ? body.label.trim() : "";
  const startDate = body.startDate ? new Date(body.startDate) : (null as never);
  const endDate = body.endDate ? new Date(body.endDate) : (null as never);
  if (!label || !startDate || !endDate) {
    return NextResponse.json({ error: "Label, kategori, dan rentang tanggal wajib diisi" }, { status: 400 });
  }

  const employees = await prisma.employee.findMany({ where: { status: "active" } });
  const inCategory = employees.filter((e) => employeeCategory(e.outlet) === category);
  const schedules = new Map(inCategory.map((e) => [e.id, e.workSchedule]));
  const summaries = await computeAttendanceSummaries(inCategory.map((e) => e.id), startDate, endDate, schedules);

  const period = await prisma.$transaction(async (tx) => {
    const created = await tx.payrollPeriod.create({
      data: { label, category, startDate, endDate, createdById: user.id },
    });

    for (const emp of inCategory) {
      const s = summaries.get(emp.id) ?? {
        daysPresent: 0,
        overtimeMinutes: 0,
        totalMinutes: 0,
        lateCount: 0,
        incompleteClockInCount: 0,
        incompleteClockOutCount: 0,
      };

      await tx.payrollItem.create({
        data: {
          periodId: created.id,
          employeeId: emp.id,
          ...computeKantorPayrollFields(emp, s),
        },
      });
    }

    return created;
  });

  return NextResponse.json(period, { status: 201 });
}
