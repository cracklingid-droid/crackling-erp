import { prisma } from "./db";

// Helper baca buku besar - dipakai Laporan (P&L/Neraca/Arus Kas), tab
// "Jurnal" per akun bank, & cek proteksi hapus (rekonsiliasi). Semua angka
// DITURUNKAN dari JournalLine, tidak ada saldo yang disimpan terpisah
// (keputusan desain double-entry, lihat plan).

export type AccountBalance = {
  accountId: number;
  code: string;
  name: string;
  type: string;
  subType: string | null;
  parentId: number | null;
  debit: number;
  credit: number;
  // saldo bertanda sesuai saldo normal akun: ASSET/EXPENSE = debit-kredit,
  // LIABILITY/EQUITY/REVENUE = kredit-debit -> angka positif = "normal".
  balance: number;
};

export function normalBalance(type: string, debit: number, credit: number): number {
  return type === "ASSET" || type === "EXPENSE" ? debit - credit : credit - debit;
}

// Saldo semua akun utk rentang tanggal (P&L: pakai start..end periode;
// Neraca: start = null -> akumulasi sejak awal buku s/d asOf). outletName
// opsional utk laporan per outlet (pakai outletName baris, fallback ke
// outletName entry - baris tanpa outlet = konsolidasi, TIDAK ikut kalau
// difilter per outlet).
export async function getAccountBalances(opts: { start: Date | null; end: Date; outletName?: string | null }): Promise<AccountBalance[]> {
  const accounts = await prisma.account.findMany({ orderBy: { code: "asc" } });
  const lines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { date: { ...(opts.start ? { gte: opts.start } : {}), lte: opts.end } },
      ...(opts.outletName ? { OR: [{ outletName: opts.outletName }, { outletName: null, journalEntry: { outletName: opts.outletName } }] } : {}),
    },
    select: { accountId: true, debit: true, credit: true },
  });

  const sums = new Map<number, { debit: number; credit: number }>();
  for (const l of lines) {
    const s = sums.get(l.accountId) ?? { debit: 0, credit: 0 };
    s.debit += l.debit;
    s.credit += l.credit;
    sums.set(l.accountId, s);
  }

  return accounts.map((a) => {
    const s = sums.get(a.id) ?? { debit: 0, credit: 0 };
    return {
      accountId: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      subType: a.subType,
      parentId: a.parentId,
      debit: s.debit,
      credit: s.credit,
      balance: normalBalance(a.type, s.debit, s.credit),
    };
  });
}

// Laba bersih periode = total REVENUE - total EXPENSE (saldo normal).
export function netIncome(balances: AccountBalance[]): number {
  let revenue = 0;
  let expense = 0;
  for (const b of balances) {
    if (b.type === "REVENUE") revenue += b.balance;
    else if (b.type === "EXPENSE") expense += b.balance;
  }
  return revenue - expense;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

export function parseDateParam(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Baris jurnal yang sudah dicocokkan ke mutasi bank (rekonsiliasi) - entry
// yang punya baris matched TIDAK BOLEH dihapus/dibalik sebelum di-unrecon
// (permintaan Kevin 2026-09-14, ikut aturan Jurnal.id).
export async function reconciledLineIdsForEntry(journalEntryId: number): Promise<number[]> {
  const lines = await prisma.journalLine.findMany({ where: { journalEntryId }, select: { id: true } });
  if (lines.length === 0) return [];
  const matched = await prisma.bankStatementLine.findMany({
    where: { matchedJournalLineId: { in: lines.map((l) => l.id) } },
    select: { matchedJournalLineId: true },
  });
  return matched.map((m) => m.matchedJournalLineId!);
}
