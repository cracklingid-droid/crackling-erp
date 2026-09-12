import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentEmployee } from "@/lib/current-employee";
import { fieldsForCategory, computeNetPay } from "@/lib/payroll-fields";

// Riwayat slip gaji selama pernah bekerja - cuma periode yang sudah "final"
// (bukan draft yang angkanya masih bisa berubah). Permintaan Kevin
// 2026-09-12: "id password yang bisa mengakses historis slip gaji yang
// selama pernah bekerja".
export async function GET() {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const items = await prisma.payrollItem.findMany({
    where: { employeeId: employee.id, period: { status: "final" } },
    include: { period: { select: { id: true, label: true, startDate: true, endDate: true, category: true } } },
    orderBy: { period: { endDate: "desc" } },
  });

  return NextResponse.json(
    items.map((item) => ({
      itemId: item.id,
      periodId: item.period.id,
      label: item.period.label,
      startDate: item.period.startDate,
      endDate: item.period.endDate,
      category: item.period.category,
      netPay: computeNetPay(item as unknown as Record<string, number>, fieldsForCategory(item.period.category)),
    }))
  );
}
