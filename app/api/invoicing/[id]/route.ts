import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessInvoicing } from "@/lib/current-user";
import { reconciledLineIdsForEntry } from "@/lib/accounting-reports";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessInvoicing(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id: Number(id) },
    include: { lines: true, createdBy: { select: { name: true } }, paidBy: { select: { name: true } }, paidBankAccount: true },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 });
  return NextResponse.json(invoice);
}

// Batalkan invoice - record-nya TETAP ADA (nomor invoice tidak dipakai
// ulang), status jadi "cancelled" & jurnal pengakuan pendapatannya DIHAPUS
// (bukan dibalik) - sama pola persis dgn DELETE Direct Expense
// (app/api/accounting/expenses/[id]/route.ts): boleh krn belum ada dampak
// riil (belum lunas), ditolak kalau sudah lunas/direkonsiliasi/periode
// terkunci (aturan Jurnal.id, permintaan Kevin 2026-09-14).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessInvoicing(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id: Number(id) } });
  if (!invoice) return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 });
  if (invoice.status === "paid") {
    return NextResponse.json({ error: "Invoice sudah lunas - tidak bisa dibatalkan." }, { status: 400 });
  }
  if (invoice.status === "cancelled") {
    return NextResponse.json({ error: "Invoice sudah dibatalkan." }, { status: 400 });
  }
  if (invoice.journalEntryId) {
    const entry = await prisma.journalEntry.findUnique({ where: { id: invoice.journalEntryId } });
    if (entry?.isLocked) return NextResponse.json({ error: "Periode jurnal ini sudah dikunci - tidak bisa dibatalkan." }, { status: 400 });
    const matched = await reconciledLineIdsForEntry(invoice.journalEntryId);
    if (matched.length > 0) {
      return NextResponse.json({ error: "Invoice ini sudah direkonsiliasi dgn mutasi bank - unrecon dulu di halaman Rekonsiliasi." }, { status: 400 });
    }
  }

  const body = await req.json().catch(() => ({}));
  const cancelReason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null;

  await prisma.$transaction(async (tx) => {
    if (invoice.journalEntryId) await tx.journalEntry.delete({ where: { id: invoice.journalEntryId } });
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: "cancelled", cancelledAt: new Date(), cancelReason, journalEntryId: null },
    });
  });
  return NextResponse.json({ ok: true });
}
