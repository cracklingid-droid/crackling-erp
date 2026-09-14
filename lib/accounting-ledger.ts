import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

// Satu-satunya pintu masuk utk menulis jurnal (JournalEntry+JournalLine) -
// SEMUA modul transaksi (Record Sales/COGS/Direct Expense/Depresiasi/manual)
// WAJIB lewat sini, jangan pernah prisma.journalEntry.create() langsung dari
// route lain. Ini menjaga 2 invariant inti double-entry: (1) tiap entry
// balance (total debit = total kredit), (2) tidak ada entry baru bertanggal
// di periode yang sudah dikunci. Permintaan & keputusan Kevin 2026-09-14 -
// lihat plan C:\Users\inu\.claude\plans\nifty-nibbling-treasure.md.

export type JournalLineInput = {
  accountId: number;
  debit?: number;
  credit?: number;
  outletName?: string | null;
  contactId?: number | null;
  description?: string | null;
};

export type PostJournalEntryInput = {
  date: Date;
  memo: string;
  sourceType: string;
  sourceId?: string | null;
  outletName?: string | null;
  createdById?: number | null;
  reversalOfId?: number | null;
  lines: JournalLineInput[];
};

export class AccountingPostingError extends Error {}

function yearMonthOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function assertPeriodNotLocked(tx: Prisma.TransactionClient, date: Date) {
  const period = await tx.accountingPeriod.findUnique({ where: { yearMonth: yearMonthOf(date) } });
  if (period?.isLocked) {
    throw new AccountingPostingError(`Periode ${period.yearMonth} sudah dikunci - tidak bisa posting jurnal baru.`);
  }
}

function validateLines(lines: JournalLineInput[]) {
  if (lines.length < 2) throw new AccountingPostingError("Jurnal minimal 2 baris (1 debit, 1 kredit).");
  let totalDebit = 0;
  let totalCredit = 0;
  for (const l of lines) {
    const debit = l.debit ?? 0;
    const credit = l.credit ?? 0;
    if (debit < 0 || credit < 0) throw new AccountingPostingError("Debit/kredit tidak boleh negatif.");
    if (debit > 0 && credit > 0) throw new AccountingPostingError("1 baris jurnal tidak boleh mengisi debit & kredit sekaligus.");
    if (debit === 0 && credit === 0) throw new AccountingPostingError("Ada baris jurnal yang nilainya 0 - hapus baris itu.");
    totalDebit += debit;
    totalCredit += credit;
  }
  if (totalDebit !== totalCredit) {
    throw new AccountingPostingError(`Jurnal tidak balance: total debit Rp${totalDebit.toLocaleString("id-ID")} != total kredit Rp${totalCredit.toLocaleString("id-ID")}.`);
  }
  if (totalDebit === 0) throw new AccountingPostingError("Jurnal tidak boleh bernilai Rp0.");
}

// tx opsional - default ke client biasa (auto-transaction internal Prisma per
// create), TAPI kalau dipanggil dari dalam prisma.$transaction() milik
// pemanggil (mis. replaceJournalEntry di bawah, atau modul lain yang perlu
// posting + update dokumen sumbernya sbg 1 unit atomik), WAJIB oper tx-nya
// supaya validasi & insert benar-benar 1 transaksi.
export async function postJournalEntry(input: PostJournalEntryInput, tx: Prisma.TransactionClient = prisma) {
  validateLines(input.lines);
  await assertPeriodNotLocked(tx, input.date);
  return tx.journalEntry.create({
    data: {
      date: input.date,
      memo: input.memo,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      outletName: input.outletName ?? null,
      createdById: input.createdById ?? null,
      reversalOfId: input.reversalOfId ?? null,
      lines: {
        create: input.lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
          outletName: l.outletName ?? null,
          contactId: l.contactId ?? null,
          description: l.description ?? null,
        })),
      },
    },
    include: { lines: true },
  });
}

// Hapus + posting ulang entry lama dgn sourceType+sourceId sama, dalam 1
// transaksi - dipakai modul sync (COGS/Record Sales/Depresiasi) spy re-sync
// idempoten & TIDAK PERNAH numpuk dobel entry utk sumber+tanggal yang sama
// (pola sama spt tombol "Sync Sekarang" Cost Center yang sudah ada).
export async function replaceJournalEntry(input: PostJournalEntryInput) {
  if (!input.sourceId) throw new AccountingPostingError("replaceJournalEntry butuh sourceId.");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.journalEntry.findFirst({ where: { sourceType: input.sourceType, sourceId: input.sourceId! } });
    if (existing) {
      if (existing.isLocked) {
        throw new AccountingPostingError(`Entry ${input.sourceType}/${input.sourceId} sudah dikunci - tidak bisa di-sync ulang.`);
      }
      await tx.journalEntry.delete({ where: { id: existing.id } }); // cascade hapus JournalLine terkait
    }
    return postJournalEntry(input, tx);
  });
}

// Koreksi lewat jurnal balik (bukan edit/hapus langsung) - dipakai utk entry
// yang sudah posting & ternyata salah, supaya jejak audit tetap utuh.
export async function reverseJournalEntry(journalEntryId: number, createdById: number | null) {
  return prisma.$transaction(async (tx) => {
    const original = await tx.journalEntry.findUniqueOrThrow({ where: { id: journalEntryId }, include: { lines: true } });
    return postJournalEntry(
      {
        date: new Date(),
        memo: `Koreksi (jurnal balik) dari #${original.id}: ${original.memo}`,
        sourceType: original.sourceType,
        sourceId: original.sourceId ? `${original.sourceId}-REVERSAL-${Date.now()}` : null,
        outletName: original.outletName,
        createdById,
        reversalOfId: original.id,
        lines: original.lines.map((l) => ({
          accountId: l.accountId,
          debit: l.credit,
          credit: l.debit,
          outletName: l.outletName,
          contactId: l.contactId,
          description: l.description,
        })),
      },
      tx
    );
  });
}
