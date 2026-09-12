import { NextResponse } from "next/server";
import { getCurrentUser, canAccessCostCenter } from "@/lib/current-user";
import { getOmzetDailyByOutlet } from "@/lib/cost-center-sales";
import { getWarehouseUsageCostByOutletDaily } from "@/lib/cost-center-warehouse";
import { getPayrollDailyRatesByOutlet } from "@/lib/cost-center-hr";

// Outlet penjualan yang dicakup dashboard harian - Joglo (Central Kitchen)
// sengaja tidak ada di sini, sama seperti laporan per-periode (bukan titik
// jual). Permintaan Kevin 2026-09-12.
const SELLING_OUTLETS = ["Gading Serpong", "Kelapa Gading", "Fatgai"];

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDateParam(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Dashboard Harian Cost Center: Omzet + Biaya Pemakaian Stok + Biaya Gaji
// (harian, dari periode Payroll Outlet mana pun yg mencakup tanggal itu -
// TIDAK disyaratkan "final", beda dari /api/cost-center yg per-periode) per
// hari, dalam 1 rentang tanggal bebas - default 7 hari terakhir. Bisa
// difilter ke 1 outlet. Permintaan Kevin 2026-09-12 (sebelumnya Cost
// Center kosong total kalau belum ada periode Payroll Outlet yg final).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessCostCenter(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const url = new URL(req.url);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const defaultStart = new Date(today);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 6);

  const startDate = parseDateParam(url.searchParams.get("start")) ?? defaultStart;
  const endDate = parseDateParam(url.searchParams.get("end")) ?? today;
  const outletParam = url.searchParams.get("outlet");
  const outletFilter = outletParam && SELLING_OUTLETS.includes(outletParam) ? outletParam : null;

  if (startDate.getTime() > endDate.getTime()) {
    return NextResponse.json({ error: "Tanggal awal harus sebelum/sama dengan tanggal akhir" }, { status: 400 });
  }
  const spanDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  if (spanDays > 366) {
    return NextResponse.json({ error: "Rentang tanggal maksimal 366 hari" }, { status: 400 });
  }

  let usageByDate = new Map<string, { hrOutletName: string; usageCost: number }[]>();
  let warehouseError: string | null = null;
  try {
    usageByDate = await getWarehouseUsageCostByOutletDaily(startDate, endDate);
  } catch (e) {
    // Warehouse sistem terpisah - kalau gagal, Omzet & Biaya Gaji tetap
    // tampil, Biaya Pemakaian kosong + pesan jelas (bukan 500 total).
    warehouseError = e instanceof Error ? e.message : "Gagal membaca data Warehouse";
  }

  const [omzetByDate, payrollByDate] = await Promise.all([
    getOmzetDailyByOutlet(startDate, endDate),
    getPayrollDailyRatesByOutlet(startDate, endDate),
  ]);

  const outlets = outletFilter ? [outletFilter] : SELLING_OUTLETS;

  const days: {
    date: string;
    omzet: number;
    usageCost: number;
    payrollCost: number;
    totalCost: number;
    grossProfit: number;
    hasSalesData: boolean;
    hasPayrollData: boolean;
  }[] = [];

  for (let d = new Date(startDate); d.getTime() <= endDate.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    const key = dateKey(d);
    const omzetRows = (omzetByDate.get(key) ?? []).filter((r) => outlets.includes(r.outletName));
    const usageRows = (usageByDate.get(key) ?? []).filter((r) => outlets.includes(r.hrOutletName));
    const payrollRows = (payrollByDate.get(key) ?? []).filter((r) => outlets.includes(r.outletName));

    const omzet = omzetRows.reduce((s, r) => s + r.totalOmzet, 0);
    const usageCost = usageRows.reduce((s, r) => s + r.usageCost, 0);
    const payrollCost = payrollRows.reduce((s, r) => s + r.dailyCost, 0);
    const totalCost = usageCost + payrollCost;
    const hasSalesData = omzetRows.length > 0;

    days.push({
      date: key,
      omzet,
      usageCost,
      payrollCost,
      totalCost,
      grossProfit: omzet - totalCost,
      hasSalesData,
      hasPayrollData: payrollRows.length > 0,
    });
  }

  const totals = days.reduce(
    (acc, d) => {
      acc.usageCost += d.usageCost;
      acc.payrollCost += d.payrollCost;
      acc.totalCost += d.totalCost;
      if (d.hasSalesData) {
        acc.omzet += d.omzet;
        acc.grossProfit += d.grossProfit;
      }
      return acc;
    },
    { omzet: 0, usageCost: 0, payrollCost: 0, totalCost: 0, grossProfit: 0 }
  );

  return NextResponse.json({
    startDate: dateKey(startDate),
    endDate: dateKey(endDate),
    outlet: outletFilter,
    outlets: SELLING_OUTLETS,
    days,
    totals,
    warehouseError,
  });
}
