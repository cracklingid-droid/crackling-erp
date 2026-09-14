import { prisma } from "./db";
import { replaceJournalEntry } from "./accounting-ledger";

// Penyusutan aset tetap metode garis lurus (straight-line) per bulan.
// Konvensi: bulan perolehan sudah dapat 1 bulan penuh penyusutan, bulan
// terakhir menyerap sisa pembulatan supaya akumulasi persis = harga
// perolehan - nilai residu. Posting jurnal WAJIB lewat lib/accounting-ledger.ts.

export type DepreciableAsset = {
  acquisitionDate: Date;
  acquisitionCost: number;
  usefulLifeMonths: number;
  residualValue: number;
};

export type RunDepreciationSummary = {
  yearMonth: string;
  postedAssets: number;
  totalAmount: number;
  skipped: number;
};

export function yearMonthOfUTC(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Tanggal jurnal penyusutan = hari terakhir bulan itu (00:00 UTC).
export function lastDayOfMonthUTC(yearMonth: string): Date {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0));
}

export function monthlyDepreciation(asset: DepreciableAsset): number {
  if (asset.usefulLifeMonths < 1) return 0;
  return Math.floor(Math.max(0, asset.acquisitionCost - asset.residualValue) / asset.usefulLifeMonths);
}

// alreadyPostedTotal = jumlah penyusutan yang sudah diposting utk aset ini
// DI LUAR bulan yang sedang dihitung (supaya hitung ulang bulan sama idempoten).
export function computeDepreciationForMonth(asset: DepreciableAsset, yearMonth: string, alreadyPostedTotal: number): number {
  const depreciable = asset.acquisitionCost - asset.residualValue;
  if (depreciable <= 0) return 0;
  // Belum dibeli di bulan itu - format "YYYY-MM" aman dibandingkan sbg string.
  if (yearMonthOfUTC(asset.acquisitionDate) > yearMonth) return 0;
  const remaining = depreciable - alreadyPostedTotal;
  if (remaining <= 0) return 0; // sudah habis disusutkan
  const monthly = monthlyDepreciation(asset);
  // Bulan terakhir: sisa (termasuk sisa pembulatan floor) diposting sekaligus.
  if (remaining < monthly * 2) return remaining;
  return monthly;
}

// Posting penyusutan semua aset aktif utk 1 bulan. Aman dijalankan berulang:
// jurnal lama dgn sourceId sama diganti (replaceJournalEntry), baris
// FixedAssetDepreciation di-upsert.
export async function runDepreciation({ yearMonth, createdById }: { yearMonth: string; createdById: number | null }): Promise<RunDepreciationSummary> {
  const assets = await prisma.fixedAsset.findMany({
    where: { isActive: true },
    include: { depreciationEntries: true },
    orderBy: { id: "asc" },
  });

  const summary: RunDepreciationSummary = { yearMonth, postedAssets: 0, totalAmount: 0, skipped: 0 };
  const date = lastDayOfMonthUTC(yearMonth);

  for (const asset of assets) {
    const alreadyPosted = asset.depreciationEntries
      .filter((d) => d.yearMonth !== yearMonth)
      .reduce((sum, d) => sum + d.amount, 0);
    const amount = computeDepreciationForMonth(asset, yearMonth, alreadyPosted);
    if (amount <= 0) {
      summary.skipped++;
      continue;
    }

    const entry = await replaceJournalEntry({
      date,
      memo: `Penyusutan ${asset.name} ${yearMonth}`,
      sourceType: "DEPRECIATION",
      sourceId: `${asset.id}-${yearMonth}`,
      createdById,
      lines: [
        { accountId: asset.depreciationExpenseAccountId, debit: amount, description: asset.name },
        { accountId: asset.accumDepreciationAccountId, credit: amount, description: asset.name },
      ],
    });

    await prisma.fixedAssetDepreciation.upsert({
      where: { fixedAssetId_yearMonth: { fixedAssetId: asset.id, yearMonth } },
      create: { fixedAssetId: asset.id, yearMonth, amount, journalEntryId: entry.id },
      update: { amount, journalEntryId: entry.id },
    });

    summary.postedAssets++;
    summary.totalAmount += amount;
  }

  return summary;
}
