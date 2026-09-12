import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { recalcOutletPeriod } from "@/lib/payroll-outlet-recalc";

// Tombol "Refresh dari Absensi" di halaman detail periode Payroll Outlet -
// hitung ulang field terkunci dari AttendanceRecord yang ada SEKARANG,
// tanpa perlu upload ulang. Permintaan Kevin 2026-09-12: "setiap
// memasukan absen baru, HR tinggal jalankan refresh".
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await ctx.params;
  const result = await recalcOutletPeriod(Number(id));
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
