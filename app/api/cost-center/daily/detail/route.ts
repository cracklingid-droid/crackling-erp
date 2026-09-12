import { NextResponse } from "next/server";
import { getCurrentUser, canAccessCostCenter } from "@/lib/current-user";
import { getWarehouseUsageDetailForDate } from "@/lib/cost-center-warehouse";
import { getPayrollCostByDate } from "@/lib/cost-center-hr";

const SELLING_OUTLETS = ["Gading Serpong", "Kelapa Gading", "Fatgai"];

function parseDateParam(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Rincian di balik 1 angka Biaya Pemakaian / Biaya Gaji pada 1 tanggal di
// Dashboard Harian - dipakai popup "lihat rinciannya". Biaya Gaji: cuma
// karyawan yang PUNYA absen pada tanggal itu yang muncul (lihat
// lib/cost-center-hr.ts getPayrollCostByDate). Permintaan Kevin 2026-09-12
// ("bagaimana perhitungannya" / "salah, harusnya per hari siapa yg masuk").
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessCostCenter(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const url = new URL(req.url);
  const date = parseDateParam(url.searchParams.get("date"));
  if (!date) return NextResponse.json({ error: "Tanggal wajib diisi" }, { status: 400 });
  const outletParam = url.searchParams.get("outlet");
  const outletFilter = outletParam && SELLING_OUTLETS.includes(outletParam) ? outletParam : null;

  const outlets = outletFilter ? [outletFilter] : SELLING_OUTLETS;

  let usage: Awaited<ReturnType<typeof getWarehouseUsageDetailForDate>> = [];
  let warehouseError: string | null = null;
  try {
    usage = await getWarehouseUsageDetailForDate(date, outlets);
  } catch (e) {
    warehouseError = e instanceof Error ? e.message : "Gagal membaca data Warehouse";
  }

  const dateStr = date.toISOString().slice(0, 10);
  const payrollByDate = await getPayrollCostByDate(date, date, outlets);
  const employees = (payrollByDate.get(dateStr) ?? []).sort((a, b) => b.cost - a.cost);

  return NextResponse.json({
    date: dateStr,
    outlet: outletFilter,
    usage,
    usageTotal: usage.reduce((s, l) => s + l.totalCost, 0),
    payroll: { employees },
    warehouseError,
  });
}
