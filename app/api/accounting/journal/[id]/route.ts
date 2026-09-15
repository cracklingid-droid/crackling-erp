import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessAccounting } from "@/lib/current-user";
import { reconciledLineIdsForEntry } from "@/lib/accounting-reports";

// Hapus 1 jurnal dari Jurnal Umum - HANYA utk entry yang tidak punya
// dokumen sumber di modul lain (jurnal bank/penerimaan/manual/saldo awal).
// Entry Record Sales/HPP/Direct Expense/Penyusutan dihapus lewat modulnya
// sendiri supaya dokumen sumbernya ikut konsisten. Aturan Jurnal.id
// (permintaan Kevin 2026-09-14): sudah recon atau periode terkunci ->
// tidak bisa dihapus sebelum unrecon/unlock.
const DELETABLE_SOURCES = new Set(["MANUAL", "BANK_ADJUSTMENT", "BANK_TRANSFER", "AR_RECEIPT", "OPENING_BALANCE"]);

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessAccounting(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { id } = await ctx.params;
  const entry = await prisma.journalEntry.findUnique({ where: { id: Number(id) } });
  if (!entry) return NextResponse.json({ error: "Jurnal tidak ditemukan" }, { status: 404 });
  if (!DELETABLE_SOURCES.has(entry.sourceType)) {
    return NextResponse.json({ error: `Jurnal ${entry.sourceType} dihapus lewat modul asalnya, bukan dari Jurnal Umum.` }, { status: 400 });
  }
  if (entry.isLocked) return NextResponse.json({ error: "Periode jurnal ini sudah dikunci." }, { status: 400 });
  if ((await reconciledLineIdsForEntry(entry.id)).length > 0) {
    return NextResponse.json({ error: "Jurnal ini sudah direkonsiliasi dgn mutasi bank - unrecon dulu di halaman Rekonsiliasi." }, { status: 400 });
  }

  await prisma.journalEntry.delete({ where: { id: entry.id } });
  return NextResponse.json({ ok: true });
}
