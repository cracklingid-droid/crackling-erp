import { prisma } from "./db";

export type DailyOmzet = { outletName: string; totalOmzet: number };

// Omzet per outlet per tanggal, dari DailySales yang sudah disinkron
// (lib/sales-sheet.ts) - TIDAK live-fetch ke Google Sheets di sini, cuma
// baca hasil sync terakhir yang tersimpan. Dipakai Dashboard Harian Cost
// Center. Permintaan Kevin 2026-09-12.
export async function getOmzetDailyByOutlet(startDate: Date, endDate: Date): Promise<Map<string, DailyOmzet[]>> {
  const rows = await prisma.dailySales.findMany({ where: { date: { gte: startDate, lte: endDate } } });

  const byDate = new Map<string, DailyOmzet[]>();
  for (const r of rows) {
    const key = r.date.toISOString().slice(0, 10);
    const arr = byDate.get(key) ?? [];
    arr.push({ outletName: r.outletName, totalOmzet: r.totalOmzet });
    byDate.set(key, arr);
  }
  return byDate;
}
