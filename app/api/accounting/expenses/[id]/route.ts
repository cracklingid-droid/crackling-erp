import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";
import { reconciledLineIdsForEntry } from "@/lib/accounting-reports";

// Hapus Direct Expense + jurnalnya. DITOLAK kalau jurnalnya sudah
// dicocokkan ke mutasi bank (harus unrecon dulu di halaman Rekonsiliasi)
// atau periodenya sudah dikunci - aturan Jurnal.id yang diminta Kevin
// 2026-09-14 ("jika transaksi sudah di record maka tidak diperbolehkan
// untuk dihapus kecuali sudah melewati tahap unrecon").
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { id } = await ctx.params;
  const expense = await prisma.directExpense.findUnique({ where: { id: Number(id) } });
  if (!expense) return NextResponse.json({ error: "Direct Expense tidak ditemukan" }, { status: 404 });

  if (expense.journalEntryId) {
    const entry = await prisma.journalEntry.findUnique({ where: { id: expense.journalEntryId } });
    if (entry?.isLocked) return NextResponse.json({ error: "Periode jurnal ini sudah dikunci - tidak bisa dihapus." }, { status: 400 });
    const matched = await reconciledLineIdsForEntry(expense.journalEntryId);
    if (matched.length > 0) {
      return NextResponse.json(
        { error: "Transaksi ini sudah direkonsiliasi dgn mutasi bank - lakukan unrecon dulu di halaman Rekonsiliasi sebelum dihapus." },
        { status: 400 }
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.directExpense.delete({ where: { id: expense.id } });
    if (expense.journalEntryId) await tx.journalEntry.delete({ where: { id: expense.journalEntryId } });
  });
  return NextResponse.json({ ok: true });
}
