import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";

// Cocokkan (recon) 1 baris mutasi bank <-> 1 baris jurnal akun bank yang
// sama, atau lepas (unrecon). Aturan Jurnal.id yang diminta Kevin
// 2026-09-14: transaksi yang sudah recon tidak bisa dihapus sebelum
// unrecon - proteksinya ada di tiap route hapus (lihat
// reconciledLineIdsForEntry), di sini cuma pasang/lepas pasangannya.
// Nominal harus sama persis & arah harus cocok (mutasi + = jurnal debit
// bank, mutasi - = jurnal kredit bank) - selisih ditolak, bukan dipaksa.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const body = await req.json();
  const statementLineId = Number(body.statementLineId);
  const journalLineId = Number(body.journalLineId);
  if (!Number.isInteger(statementLineId) || !Number.isInteger(journalLineId)) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
  }

  const [stmt, jl] = await Promise.all([
    prisma.bankStatementLine.findUnique({ where: { id: statementLineId }, include: { bankAccount: true } }),
    prisma.journalLine.findUnique({ where: { id: journalLineId } }),
  ]);
  if (!stmt) return NextResponse.json({ error: "Mutasi bank tidak ditemukan" }, { status: 404 });
  if (!jl) return NextResponse.json({ error: "Baris jurnal tidak ditemukan" }, { status: 404 });
  if (stmt.matchedJournalLineId) return NextResponse.json({ error: "Mutasi ini sudah dicocokkan - unrecon dulu." }, { status: 400 });
  if (jl.accountId !== stmt.bankAccount.accountId) {
    return NextResponse.json({ error: "Baris jurnal ini bukan milik akun bank yang sama." }, { status: 400 });
  }
  const journalAmount = jl.debit - jl.credit;
  if (journalAmount !== stmt.amount) {
    return NextResponse.json(
      { error: `Nominal tidak sama: mutasi Rp${stmt.amount.toLocaleString("id-ID")} vs jurnal Rp${journalAmount.toLocaleString("id-ID")}.` },
      { status: 400 }
    );
  }
  const alreadyUsed = await prisma.bankStatementLine.findUnique({ where: { matchedJournalLineId: journalLineId } });
  if (alreadyUsed) return NextResponse.json({ error: "Baris jurnal ini sudah dicocokkan ke mutasi lain." }, { status: 400 });

  await prisma.bankStatementLine.update({ where: { id: statementLineId }, data: { matchedJournalLineId: journalLineId } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const body = await req.json();
  const statementLineId = Number(body.statementLineId);
  if (!Number.isInteger(statementLineId)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  const stmt = await prisma.bankStatementLine.findUnique({ where: { id: statementLineId } });
  if (!stmt) return NextResponse.json({ error: "Mutasi bank tidak ditemukan" }, { status: 404 });
  if (!stmt.matchedJournalLineId) return NextResponse.json({ error: "Mutasi ini belum dicocokkan." }, { status: 400 });

  await prisma.bankStatementLine.update({ where: { id: statementLineId }, data: { matchedJournalLineId: null } });
  return NextResponse.json({ ok: true });
}
