import { prisma } from "./db";

export type OutletOmzet = { outletName: string; totalOmzet: number; lastSyncedAt: Date | null };

// Omzet per outlet dalam 1 rentang tanggal, dari DailySales yang sudah
// disinkron (lib/sales-sheet.ts) - TIDAK live-fetch ke Google Sheets di
// sini, cuma baca hasil sync terakhir yang tersimpan. Permintaan Kevin
// 2026-09-12.
export async function getOmzetByOutlet(startDate: Date, endDate: Date): Promise<OutletOmzet[]> {
  const rows = await prisma.dailySales.findMany({
    where: { date: { gte: startDate, lte: endDate } },
  });

  const byOutlet = new Map<string, { totalOmzet: number; lastSyncedAt: Date }>();
  for (const r of rows) {
    const existing = byOutlet.get(r.outletName) ?? { totalOmzet: 0, lastSyncedAt: r.syncedAt };
    existing.totalOmzet += r.totalOmzet;
    if (r.syncedAt > existing.lastSyncedAt) existing.lastSyncedAt = r.syncedAt;
    byOutlet.set(r.outletName, existing);
  }

  return Array.from(byOutlet.entries()).map(([outletName, v]) => ({
    outletName,
    totalOmzet: v.totalOmzet,
    lastSyncedAt: v.lastSyncedAt,
  }));
}
