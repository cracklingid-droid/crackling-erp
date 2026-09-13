import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHrWriteUser } from "@/lib/hr-access";
import { OUTLET_LOCKED_FIELD_KEYS } from "@/lib/payroll-outlet-calc";
import { KANTOR_LOCKED_FIELD_KEYS } from "@/lib/payroll-kantor-calc";

const NUMBER_FIELDS = [
  "baseSalary",
  "partTimePay",
  "mealAllowance",
  "transportReimbursement",
  "overtimePay",
  "attendanceDeduction",
  "bpjsKesehatanDeduction",
  "bpjsKetenagakerjaanDeduction",
  "pph21Deduction",
  "loanDeduction",
  "otherAdjustment",
  "lateCount",
  "lateDeduction",
  "incidentDeduction",
  "warningLetterDeduction",
  "depositDeduction",
  "depositRefund",
  "serviceCharge",
  "bonus",
  // Payroll Kantor (permintaan Kevin 2026-09-13) - lihat lib/payroll-kantor-calc.ts
  "bonusSales",
  "incompleteClockInCount",
  "incompleteClockInDeduction",
  "incompleteClockOutCount",
  "incompleteClockOutDeduction",
  "bpjsAllowance",
  "bpjsEmployerObligation",
  "bpjsRemittance",
  "fuelKm",
];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const { error } = await requireHrWriteUser();
  if (error) return error;

  const { id, itemId } = await ctx.params;
  const period = await prisma.payrollPeriod.findUnique({ where: { id: Number(id) }, select: { status: true, category: true } });
  if (!period) return NextResponse.json({ error: "Periode tidak ditemukan" }, { status: 404 });
  if (period.status === "final") {
    return NextResponse.json({ error: "Periode ini sudah difinalisasi, tidak bisa diedit lagi" }, { status: 400 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const f of NUMBER_FIELDS) {
    // Field yang asalnya dari absensi/konfigurasi karyawan dikunci - dihitung
    // ulang otomatis, bukan input manual HR (keputusan Kevin 2026-09-12
    // utk Outlet, 2026-09-13 utk Kantor - field/rumusnya beda total).
    if (period.category === "outlet" && OUTLET_LOCKED_FIELD_KEYS.has(f)) continue;
    if (period.category === "kantor" && KANTOR_LOCKED_FIELD_KEYS.has(f)) continue;
    if (f in body) data[f] = Number(body[f]) || 0;
  }
  if ("note" in body) data.note = body.note || null;

  const existing = await prisma.payrollItem.findUnique({
    where: { id: Number(itemId) },
    select: { employeeId: true, depositDeduction: true, depositRefund: true, employee: { select: { kantorFuelRatePerKm: true } } },
  });

  // Reimburse Bensin (Kantor): KM diinput manual, tapi nominalnya SELALU
  // diturunkan dari KM x rate karyawan - tidak pernah diketik langsung, biar
  // tidak pernah tidak-sinkron dgn rate yang tersimpan. Permintaan Kevin
  // 2026-09-13.
  if (period.category === "kantor" && "fuelKm" in data) {
    data.fuelReimbursement = (existing?.employee.kantorFuelRatePerKm ?? 0) * (data.fuelKm as number);
  }

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.payrollItem.update({ where: { id: Number(itemId) }, data });

    // Saldo deposit kontrak karyawan mengikuti setiap perubahan "Bayar
    // Deposit"/"Kembali Deposit" di periode manapun, supaya selalu
    // mencerminkan deposit yang masih ditahan. Permintaan Kevin 2026-09-11.
    if (existing && ("depositDeduction" in data || "depositRefund" in data)) {
      const deltaDeduction = (data.depositDeduction as number | undefined ?? existing.depositDeduction) - existing.depositDeduction;
      const deltaRefund = (data.depositRefund as number | undefined ?? existing.depositRefund) - existing.depositRefund;
      const balanceDelta = deltaDeduction - deltaRefund;
      if (balanceDelta !== 0) {
        const employee = await tx.employee.findUnique({ where: { id: existing.employeeId }, select: { depositBalance: true } });
        const nextBalance = Math.max(0, (employee?.depositBalance ?? 0) + balanceDelta);
        await tx.employee.update({ where: { id: existing.employeeId }, data: { depositBalance: nextBalance } });
      }
    }

    return updated;
  });

  return NextResponse.json(item);
}
