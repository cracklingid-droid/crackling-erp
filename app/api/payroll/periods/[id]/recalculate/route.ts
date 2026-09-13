import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHrWriteUser } from "@/lib/hr-access";
import { recalcOutletPeriod } from "@/lib/payroll-outlet-recalc";
import { recalcKantorPeriod } from "@/lib/payroll-kantor-recalc";

// Tombol "Refresh dari Absensi" di halaman detail periode - hitung ulang
// field terkunci dari AttendanceRecord yang ada SEKARANG, tanpa perlu upload
// ulang. Permintaan Kevin 2026-09-12 (Outlet) & 2026-09-13 (diperluas ke
// Kantor, formula beda total - lihat lib/payroll-kantor-recalc.ts).
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireHrWriteUser();
  if (error) return error;

  const { id } = await ctx.params;
  const period = await prisma.payrollPeriod.findUnique({ where: { id: Number(id) }, select: { category: true } });
  if (!period) return NextResponse.json({ error: "Periode tidak ditemukan" }, { status: 404 });

  const result = period.category === "kantor" ? await recalcKantorPeriod(Number(id)) : await recalcOutletPeriod(Number(id));
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
