import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import {
  employeeCategory,
  calcOvertimePay,
  calcBpjsKesehatan,
  calcBpjsKetenagakerjaan,
  calcOutletOvertimePay,
  calcOutletMealAllowance,
  calcOutletTransportAllowance,
  DEFAULT_DAILY_MEAL_ALLOWANCE,
} from "@/lib/payroll-config";
import { computeAttendanceSummaries } from "@/lib/attendance-summary";

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
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const category = body.category === "outlet" || body.category === "kantor" ? body.category : null;
  const startDate = body.startDate ? new Date(body.startDate) : null;
  const endDate = body.endDate ? new Date(body.endDate) : null;
  if (!label || !category || !startDate || !endDate) {
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
      const { daysPresent, overtimeMinutes } = summaries.get(emp.id) ?? { daysPresent: 0, overtimeMinutes: 0 };
      const baseSalary = emp.baseSalary ?? 0;

      if (category === "outlet") {
        // Ikut logika spreadsheet gaji outlet Crackling (permintaan Kevin
        // 2026-09-11) - lihat komentar di lib/payroll-config.ts.
        const dailyMealRate = emp.dailyMealRate ?? 0;
        const dailyTransportRate = emp.dailyTransportRate ?? 0;
        await tx.payrollItem.create({
          data: {
            periodId: created.id,
            employeeId: emp.id,
            daysPresent,
            overtimeMinutes,
            baseSalary,
            mealAllowance: calcOutletMealAllowance(dailyMealRate, daysPresent),
            transportReimbursement: calcOutletTransportAllowance(dailyTransportRate, daysPresent),
            overtimePay: calcOutletOvertimePay(dailyMealRate, overtimeMinutes),
            bpjsKesehatanDeduction: calcBpjsKesehatan(baseSalary),
            bpjsKetenagakerjaanDeduction: calcBpjsKetenagakerjaan(baseSalary),
          },
        });
      } else {
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
    }

    return created;
  });

  return NextResponse.json(period, { status: 201 });
}
