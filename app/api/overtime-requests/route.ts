import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHrReadUser } from "@/lib/hr-access";
import { employeeCategory } from "@/lib/payroll-config";

// List Pengajuan Lembur SPV utk sisi admin (approval manager+HR). Scope
// baca sama persis dgn requireHrReadUser (HR penuh = semua, "manager" =
// outlet/resto saja) krn fitur SPV ini murni resto - permintaan Kevin
// 2026-09-14.
export async function GET(req: Request) {
  const { user, error } = await requireHrReadUser();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const requests = await prisma.overtimeRequest.findMany({
    where: status ? { status } : undefined,
    include: {
      employee: { select: { id: true, name: true, position: true, outlet: true } },
      managerDecisionBy: { select: { id: true, name: true } },
      hrDecisionBy: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
  });

  const scoped = user.role === "manager" ? requests.filter((r) => employeeCategory(r.employee.outlet) === "outlet") : requests;
  return NextResponse.json(scoped);
}
