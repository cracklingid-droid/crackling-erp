import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import {
  employeeCategory,
  calcOvertimePay,
  calcBpjsKesehatan,
  calcBpjsKetenagakerjaan,
  DEFAULT_DAILY_MEAL_ALLOWANCE,
  CONTRACT_DEPOSIT_INSTALLMENT,
  CONTRACT_DEPOSIT_INSTALLMENT_COUNT,
} from "@/lib/payroll-config";
import { computeOutletPayrollFields } from "@/lib/payroll-outlet-calc";
import { nextOutletPeriodRange, outletPeriodLabel } from "@/lib/payroll-outlet-schedule";
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
  const category = body.category === "outlet" || body.category === "kantor" ? body.category : null;
  if (!category) return NextResponse.json({ error: "Kategori wajib diisi" }, { status: 400 });

  let label: string;
  let startDate: Date;
  let endDate: Date;

  if (category === "outlet") {
    // Rentang tanggal & label Payroll Outlet TIDAK BISA dikustomisasi lagi -
    // dihitung sendiri oleh server dari periode outlet terakhir, mengikuti
    // jadwal tetap yang sudah diumumkan Kevin ke grup, supaya HR tidak
    // punya ruang salah input tanggal. Body startDate/endDate/label dari
    // client diabaikan sepenuhnya (bukan cuma disembunyikan di UI).
    // Keputusan Kevin 2026-09-12.
    const lastPeriod = await prisma.payrollPeriod.findFirst({
      where: { category: "outlet" },
      orderBy: { endDate: "desc" },
    });
    if (!lastPeriod) {
      return NextResponse.json(
        { error: "Belum ada periode outlet sebelumnya - hubungi developer utk seed periode pertama." },
        { status: 400 }
      );
    }
    const range = nextOutletPeriodRange(lastPeriod.endDate);
    startDate = range.start;
    endDate = range.end;
    label = outletPeriodLabel(endDate);

    const dup = await prisma.payrollPeriod.findFirst({ where: { category: "outlet", startDate, endDate } });
    if (dup) {
      return NextResponse.json({ error: `Periode "${dup.label}" utk rentang ini sudah ada.` }, { status: 400 });
    }
  } else {
    label = typeof body.label === "string" ? body.label.trim() : "";
    startDate = body.startDate ? new Date(body.startDate) : (null as never);
    endDate = body.endDate ? new Date(body.endDate) : (null as never);
    if (!label || !startDate || !endDate) {
      return NextResponse.json({ error: "Label, kategori, dan rentang tanggal wajib diisi" }, { status: 400 });
    }
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

      if (category === "outlet") {
        // Deposit wajib karyawan kontrak - Rp250rb otomatis di 2 periode
        // pertama, berhenti sendiri setelahnya. Permintaan Kevin 2026-09-11.
        const isContractDepositDue = emp.employmentStatus === "kontrak" && emp.depositInstallmentsPaid < CONTRACT_DEPOSIT_INSTALLMENT_COUNT;
        const depositDeduction = isContractDepositDue ? CONTRACT_DEPOSIT_INSTALLMENT : 0;

        await tx.payrollItem.create({
          data: {
            periodId: created.id,
            employeeId: emp.id,
            ...computeOutletPayrollFields(emp, daysPresent, overtimeMinutes),
            depositDeduction,
          },
        });

        if (isContractDepositDue) {
          await tx.employee.update({
            where: { id: emp.id },
            data: {
              depositInstallmentsPaid: { increment: 1 },
              depositBalance: { increment: CONTRACT_DEPOSIT_INSTALLMENT },
            },
          });
        }
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
