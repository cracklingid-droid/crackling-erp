import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessCostCenter } from "@/lib/current-user";
import { getOmzetDailyByOutlet, SELLING_OUTLETS } from "@/lib/cost-center-sales";
import { getWarehouseUsageCostByOutletDaily, getWarehouseUsageTopItems } from "@/lib/cost-center-warehouse";
import { getPayrollCostByDate } from "@/lib/cost-center-hr";

// Joglo (Central Kitchen) bukan titik jual (tidak ada Omzet) - tapi tetap
// punya Biaya Pemakaian (bahan yg dipakai/waste produksi) yang layak
// kelihatan buat owner, ditampilkan terpisah dari perbandingan
// Omzet/Profit antar outlet penjualan. Permintaan Kevin 2026-09-17.
const CENTRAL_KITCHEN_OUTLET = "Joglo (Central Kitchen)";

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function parseDateParam(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Ringkasan level tinggi utk POV owner - tren Omzet/Gross Profit, ranking
// antar outlet, item paling boros biaya, & ringkasan HR, dalam 1 rentang
// tanggal (default 30 hari). Dibangun DI ATAS fungsi yang sama persis
// dipakai Dashboard Harian (getOmzetDailyByOutlet/
// getWarehouseUsageCostByOutletDaily/getPayrollCostByDate) - JANGAN hitung
// ulang logika biaya dari nol, supaya angka di sini selalu cocok dgn
// Dashboard Harian yang sudah dipercaya (bisa diklik utk buka rincian di
// sana). Permintaan Kevin 2026-09-17.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessCostCenter(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const url = new URL(req.url);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const defaultStart = new Date(today);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 29);

  const startDate = parseDateParam(url.searchParams.get("start")) ?? defaultStart;
  const endDate = parseDateParam(url.searchParams.get("end")) ?? today;
  if (startDate.getTime() > endDate.getTime()) {
    return NextResponse.json({ error: "Tanggal awal harus sebelum/sama dengan tanggal akhir" }, { status: 400 });
  }
  const spanDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  if (spanDays > 366) {
    return NextResponse.json({ error: "Rentang tanggal maksimal 366 hari" }, { status: 400 });
  }

  let usageByDate = new Map<string, { hrOutletName: string; usageCost: number }[]>();
  let topExpenses: Awaited<ReturnType<typeof getWarehouseUsageTopItems>> = [];
  let warehouseError: string | null = null;
  try {
    [usageByDate, topExpenses] = await Promise.all([
      getWarehouseUsageCostByOutletDaily(startDate, endDate),
      getWarehouseUsageTopItems(startDate, endDate, [...SELLING_OUTLETS, CENTRAL_KITCHEN_OUTLET]),
    ]);
  } catch (e) {
    warehouseError = e instanceof Error ? e.message : "Gagal membaca data Warehouse";
  }

  const [omzetByDate, payrollByDate, headcountRows] = await Promise.all([
    getOmzetDailyByOutlet(startDate, endDate),
    getPayrollCostByDate(startDate, endDate, [...SELLING_OUTLETS, CENTRAL_KITCHEN_OUTLET]),
    prisma.employee.groupBy({ by: ["outlet"], where: { status: "active", outlet: { in: [...SELLING_OUTLETS, CENTRAL_KITCHEN_OUTLET] } }, _count: true }),
  ]);

  // Deret harian per outlet penjualan - dipakai utk tren keseluruhan (jumlah
  // semua outlet) & totals per outlet (byOutlet).
  const perOutletDaily = new Map<string, { date: string; omzet: number; usageCost: number; payrollCost: number }[]>();
  for (const name of [...SELLING_OUTLETS, CENTRAL_KITCHEN_OUTLET]) perOutletDaily.set(name, []);

  for (let d = new Date(startDate); d.getTime() <= endDate.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    const key = dateKey(d);
    const omzetRows = omzetByDate.get(key) ?? [];
    const usageRows = usageByDate.get(key) ?? [];
    const payrollRows = payrollByDate.get(key) ?? [];

    for (const name of [...SELLING_OUTLETS, CENTRAL_KITCHEN_OUTLET]) {
      const omzet = omzetRows.filter((r) => r.outletName === name).reduce((s, r) => s + r.totalOmzet, 0);
      const usageCost = usageRows.filter((r) => r.hrOutletName === name).reduce((s, r) => s + r.usageCost, 0);
      const payrollCost = payrollRows.filter((r) => r.outletName === name).reduce((s, r) => s + r.cost, 0);
      perOutletDaily.get(name)!.push({ date: key, omzet, usageCost, payrollCost });
    }
  }

  // Tren keseluruhan (jumlah SELLING_OUTLETS saja - Joglo tidak ikut,
  // konsisten dgn Dashboard Harian yg juga tidak menghitung Joglo ke Total
  // Biaya "Semua Outlet").
  const trend = [];
  for (let d = new Date(startDate); d.getTime() <= endDate.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    const key = dateKey(d);
    let omzet = 0, usageCost = 0, payrollCost = 0, hasSales = false;
    for (const name of SELLING_OUTLETS) {
      const row = perOutletDaily.get(name)!.find((r) => r.date === key)!;
      omzet += row.omzet;
      usageCost += row.usageCost;
      payrollCost += row.payrollCost;
      if (row.omzet > 0) hasSales = true;
    }
    trend.push({ date: key, omzet, grossProfit: omzet - usageCost - payrollCost, hasSales });
  }

  const byOutlet = SELLING_OUTLETS.map((name) => {
    const rows = perOutletDaily.get(name)!;
    const omzet = rows.reduce((s, r) => s + r.omzet, 0);
    const usageCost = rows.reduce((s, r) => s + r.usageCost, 0);
    const payrollCost = rows.reduce((s, r) => s + r.payrollCost, 0);
    return { outletName: name, omzet, usageCost, payrollCost, totalCost: usageCost + payrollCost, grossProfit: omzet - usageCost - payrollCost };
  });

  const ckRows = perOutletDaily.get(CENTRAL_KITCHEN_OUTLET)!;
  const centralKitchen = {
    outletName: CENTRAL_KITCHEN_OUTLET,
    usageCost: ckRows.reduce((s, r) => s + r.usageCost, 0),
    payrollCost: ckRows.reduce((s, r) => s + r.payrollCost, 0),
  };

  const totals = byOutlet.reduce(
    (acc, o) => {
      acc.omzet += o.omzet;
      acc.totalCost += o.totalCost;
      acc.grossProfit += o.grossProfit;
      return acc;
    },
    { omzet: 0, totalCost: 0, grossProfit: 0 }
  );

  const headcountByOutlet = [...SELLING_OUTLETS, CENTRAL_KITCHEN_OUTLET].map((name) => ({
    outletName: name,
    count: headcountRows.find((r) => r.outlet === name)?._count ?? 0,
  }));
  const payrollTrend = trend.map((t) => {
    const key = t.date;
    const cost = [...SELLING_OUTLETS, CENTRAL_KITCHEN_OUTLET].reduce(
      (s, name) => s + (perOutletDaily.get(name)!.find((r) => r.date === key)?.payrollCost ?? 0),
      0
    );
    return { date: key, cost };
  });

  return NextResponse.json({
    startDate: dateKey(startDate),
    endDate: dateKey(endDate),
    outlets: SELLING_OUTLETS,
    totals,
    trend,
    byOutlet,
    centralKitchen,
    topExpenses,
    hr: { headcountByOutlet, payrollTrend },
    warehouseError,
  });
}
