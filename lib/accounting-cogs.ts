import { prisma } from "./db";
import { getWarehouseUsageCostByOutletDaily } from "./cost-center-warehouse";
import { replaceJournalEntry, AccountingPostingError } from "./accounting-ledger";
import { reconciledLineIdsForEntry } from "./accounting-reports";

// COGS (HPP) otomatis dari Warehouse - definisi biaya pemakaian SAMA PERSIS
// dgn Cost Center (lib/cost-center-warehouse.ts: StockMovement qty<0 minus
// TRANSFER_OUT/PRODUCTION_OUT, FIFO costing milik Warehouse), keputusan Kevin
// 2026-09-14 ("otomatis dari Warehouse", jangan hitung ulang). 1 jurnal per
// outlet per hari: Dr Beban Pokok Penjualan (5-1000), Cr Persediaan
// (1-1200). Idempoten: hari yang nilainya tidak berubah dilewati, yang
// berubah di-replace (hapus+posting ulang dlm 1 transaksi), yang sudah
// dikunci/direkonsiliasi dilewati + dihitung.
export const COGS_EXPENSE_CODE = "5-1000";
export const INVENTORY_CODE = "1-1200";

export type CogsSyncSummary = {
  totalRows: number;
  created: number;
  updated: number;
  unchanged: number;
  skippedReconciled: number;
  skippedLocked: number;
  errors: string[];
};

export async function syncCogs(opts: { start: Date; end: Date; createdById: number | null }): Promise<CogsSyncSummary> {
  const [cogsAcc, invAcc] = await Promise.all([
    prisma.account.findUnique({ where: { code: COGS_EXPENSE_CODE } }),
    prisma.account.findUnique({ where: { code: INVENTORY_CODE } }),
  ]);
  if (!cogsAcc || !invAcc) throw new Error("Akun HPP (5-1000) / Persediaan (1-1200) belum ada di COA - jalankan scripts/seed-coa.ts");

  const byDate = await getWarehouseUsageCostByOutletDaily(opts.start, opts.end);
  const summary: CogsSyncSummary = { totalRows: 0, created: 0, updated: 0, unchanged: 0, skippedReconciled: 0, skippedLocked: 0, errors: [] };

  for (const [date, rows] of byDate) {
    for (const r of rows) {
      const amount = Math.round(r.usageCost);
      if (amount <= 0) continue;
      summary.totalRows++;
      const sourceId = `${r.hrOutletName}|${date}`;
      const existing = await prisma.journalEntry.findFirst({
        where: { sourceType: "COGS_SYNC", sourceId },
        include: { lines: true },
      });
      if (existing) {
        const existingAmount = existing.lines.find((l) => l.accountId === cogsAcc.id)?.debit ?? 0;
        if (existingAmount === amount) {
          summary.unchanged++;
          continue;
        }
        if ((await reconciledLineIdsForEntry(existing.id)).length > 0) {
          summary.skippedReconciled++;
          continue;
        }
      }
      try {
        await replaceJournalEntry({
          date: new Date(`${date}T00:00:00.000Z`),
          memo: `HPP pemakaian stok ${r.hrOutletName} ${date}`,
          sourceType: "COGS_SYNC",
          sourceId,
          outletName: r.hrOutletName,
          createdById: opts.createdById,
          lines: [
            { accountId: cogsAcc.id, debit: amount, outletName: r.hrOutletName, description: "Pemakaian stok (FIFO Warehouse)" },
            { accountId: invAcc.id, credit: amount, outletName: r.hrOutletName, description: "Pengurangan persediaan" },
          ],
        });
        if (existing) summary.updated++;
        else summary.created++;
      } catch (e) {
        if (e instanceof AccountingPostingError && e.message.includes("dikunci")) summary.skippedLocked++;
        else summary.errors.push(`${sourceId}: ${e instanceof Error ? e.message : "gagal"}`);
      }
    }
  }
  return summary;
}
