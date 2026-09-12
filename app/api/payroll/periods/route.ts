import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import {
  employeeCategory,
  calcOvertimePay,
  calcBpjsKesehatan,
  calcBpjsKetenagakerjaan,
  DEFAULT_DAILY_MEAL_ALLOWANCE,
} from "@/lib/payroll-config";
import { computeAttendanceSummaries } from "@/lib/attendance-summary";
import { createNextOutletPeriod } from "@/lib/payroll-outlet-auto";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const category = new URL(req.url).searchParams.get("category");
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
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

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
  const summaries = await computeAttendanceSummaries(inCategory.map((e) => e.id), startDate, endDate);

  const period = await prisma.$transaction(async (tx) => {
    const created = await tx.payrollPeriod.create({
      data: { label, category, startDate, endDate, createdById: user.id },
    });

    for (const emp of inCategory) {
      const { daysPresent, overtimeMinutes } = summaries.get(emp.id) ?? { daysPresent: 0, overtimeMinutes: 0, totalMinutes: 0, lateCount: 0 };
      const baseSalary = emp.baseSalary ?? 0;

      await tx.payrollItem.create({
        data: {
          periodId: created.id,
          employeeId: emp.id,
          daysPresent,
          overtimeMinutes,
          baseSalary,
          mealAllowance: daysPresent * DEFAULT_DAILY_MEAL_ALLOWANCE,
          overtimePay: calcOvertimePay(baseSalary, overtimeMinutes),
          bpjsKesehatanDeduction: calcBpjsKesehatan(baseSalary),
          bpjsKetenagakerjaanDeduction: calcBpjsKetenagakerjaan(baseSalary),
        },
      });
    }

    return created;
  });

  return NextResponse.json(period, { status: 201 });
}
