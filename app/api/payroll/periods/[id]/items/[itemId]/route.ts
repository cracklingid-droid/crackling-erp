import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

const NUMBER_FIELDS = [
  "baseSalary",
  "mealAllowance",
  "transportReimbursement",
  "overtimePay",
  "attendanceDeduction",
  "bpjsKesehatanDeduction",
  "bpjsKetenagakerjaanDeduction",
  "pph21Deduction",
  "loanDeduction",
  "otherAdjustment",
];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id, itemId } = await ctx.params;
  const period = await prisma.payrollPeriod.findUnique({ where: { id: Number(id) }, select: { status: true } });
  if (!period) return NextResponse.json({ error: "Periode tidak ditemukan" }, { status: 404 });
  if (period.status === "final") {
    return NextResponse.json({ error: "Periode ini sudah difinalisasi, tidak bisa diedit lagi" }, { status: 400 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const f of NUMBER_FIELDS) {
    if (f in body) data[f] = Number(body[f]) || 0;
  }
  if ("note" in body) data.note = body.note || null;

  const item = await prisma.payrollItem.update({ where: { id: Number(itemId) }, data });
  return NextResponse.json(item);
}
