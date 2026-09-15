import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";
import { postJournalEntry, AccountingPostingError } from "@/lib/accounting-ledger";

// Catat transfer antar bank / top-up petty cash dari 1 pasangan mutasi
// (keluar di bank A, masuk di bank B) sbg 1 jurnal: Dr akun bank tujuan /
// Cr akun bank asal, lalu KEDUA mutasi langsung reconciled ke baris
// jurnalnya masing-masing. Dipakai tombol "Catat transfer" di rekomendasi.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const body = await req.json();
  const fromLineId = Number(body.fromLineId);
  const toLineId = Number(body.toLineId);
  if (!Number.isInteger(fromLineId) || !Number.isInteger(toLineId)) return NextResponse.json({ error: "ID mutasi tidak valid" }, { status: 400 });

  const [from, to] = await Promise.all([
    prisma.bankStatementLine.findUnique({ where: { id: fromLineId }, include: { bankAccount: true } }),
    prisma.bankStatementLine.findUnique({ where: { id: toLineId }, include: { bankAccount: true } }),
  ]);
  if (!from || !to) return NextResponse.json({ error: "Mutasi tidak ditemukan" }, { status: 404 });
  if (from.matchedJournalLineId || to.matchedJournalLineId) return NextResponse.json({ error: "Salah satu mutasi sudah dicocokkan." }, { status: 400 });
  if (from.bankAccountId === to.bankAccountId) return NextResponse.json({ error: "Kedua mutasi harus dari akun bank berbeda." }, { status: 400 });
  if (!(from.amount < 0 && to.amount > 0)) return NextResponse.json({ error: "Mutasi asal harus keluar (-) dan tujuan masuk (+)." }, { status: 400 });
  if (Math.abs(from.amount) !== to.amount) return NextResponse.json({ error: "Nominal kedua mutasi harus sama persis." }, { status: 400 });

  const amount = to.amount;
  const note = typeof body.description === "string" && body.description.trim() ? body.description.trim() : `Transfer ${from.bankAccount.name} -> ${to.bankAccount.name}`;

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const e = await postJournalEntry(
        {
          date: to.date > from.date ? to.date : from.date,
          memo: note,
          sourceType: "BANK_TRANSFER",
          sourceId: `stmt-${from.id}-${to.id}`,
          createdById: user.id,
          lines: [
            { accountId: to.bankAccount.accountId, debit: amount, description: `Masuk dari ${from.bankAccount.name}` },
            { accountId: from.bankAccount.accountId, credit: amount, description: `Keluar ke ${to.bankAccount.name}` },
          ],
        },
        tx
      );
      const toLine = e.lines.find((l) => l.accountId === to.bankAccount.accountId)!;
      const fromLine = e.lines.find((l) => l.accountId === from.bankAccount.accountId)!;
      await tx.bankStatementLine.update({ where: { id: to.id }, data: { matchedJournalLineId: toLine.id } });
      await tx.bankStatementLine.update({ where: { id: from.id }, data: { matchedJournalLineId: fromLine.id } });
      return e;
    });
    return NextResponse.json({ ok: true, journalEntryId: entry.id });
  } catch (e) {
    if (e instanceof AccountingPostingError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
