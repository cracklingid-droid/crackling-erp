import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessInvoicing } from "@/lib/current-user";
import { postJournalEntry, AccountingPostingError } from "@/lib/accounting-ledger";
import { parseDateParam, endOfDay } from "@/lib/accounting-reports";
import { invoiceBranchByCode, INVOICE_BRANCHES } from "@/lib/invoicing-config";
import { nextInvoiceNumber } from "@/lib/invoice-numbering";
import { listSellableMenuItems } from "@/lib/invoice-items";

// Invoice manual ke customer (menu ESB, dikirim WhatsApp, dibayar QRIS
// Midtrans) - permintaan Kevin 2026-09-15. Posting: Dr AR-cabang / Cr
// Sales-cabang saat invoice DITERBITKAN (pendapatan diakui begitu invoice
// dibuat, bukan menunggu lunas - sama pola dgn Record Sales). Pelunasan
// (Dr Bank/Kliring Midtrans, Cr AR-cabang) dibuat terpisah saat status jadi
// "paid" - lihat app/api/invoicing/[id]/mark-paid & webhook/midtrans.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessInvoicing(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const branchCode = searchParams.get("branch");
  const status = searchParams.get("status");
  const end = parseDateParam(searchParams.get("end")) ?? new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const start =
    parseDateParam(searchParams.get("start")) ??
    (() => {
      const d = new Date(end);
      d.setUTCDate(d.getUTCDate() - 29);
      return d;
    })();

  const invoices = await prisma.invoice.findMany({
    where: {
      invoiceDate: { gte: start, lte: endOfDay(end) },
      ...(branchCode ? { branchCode } : {}),
      ...(status ? { status } : {}),
    },
    include: { lines: true },
    orderBy: [{ invoiceDate: "desc" }, { id: "desc" }],
  });

  return NextResponse.json({
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    branches: INVOICE_BRANCHES,
    invoices,
    totals: {
      count: invoices.length,
      unpaid: invoices.filter((i) => i.status === "unpaid").reduce((s, i) => s + i.total, 0),
      paid: invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0),
    },
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessInvoicing(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const body = await req.json();
  const branch = invoiceBranchByCode(typeof body.branchCode === "string" ? body.branchCode : "");
  const invoiceDate = parseDateParam(typeof body.invoiceDate === "string" ? body.invoiceDate : null);
  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
  const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim() : "";
  const customerAddress = typeof body.customerAddress === "string" && body.customerAddress.trim() ? body.customerAddress.trim() : null;
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  const discount = Number.isFinite(Number(body.discount)) ? Math.max(0, Math.round(Number(body.discount))) : 0;
  const rawLines: { warehouseItemId?: unknown; qty?: unknown; unitPrice?: unknown }[] = Array.isArray(body.lines) ? body.lines : [];

  if (!branch) return NextResponse.json({ error: "Cabang tidak valid" }, { status: 400 });
  if (!invoiceDate) return NextResponse.json({ error: "Tanggal invoice tidak valid" }, { status: 400 });
  if (!customerName) return NextResponse.json({ error: "Nama customer wajib diisi" }, { status: 400 });
  if (!customerPhone) return NextResponse.json({ error: "No. WhatsApp customer wajib diisi" }, { status: 400 });
  if (rawLines.length === 0) return NextResponse.json({ error: "Minimal 1 item" }, { status: 400 });

  const menu = await listSellableMenuItems();
  const menuById = new Map(menu.map((m) => [m.warehouseItemId, m]));

  const lines: { warehouseItemId: number; sku: string; name: string; unit: string; qty: number; unitPrice: number; subtotal: number }[] = [];
  for (const raw of rawLines) {
    const warehouseItemId = Number(raw.warehouseItemId);
    const qty = Math.round(Number(raw.qty));
    const unitPrice = Math.round(Number(raw.unitPrice));
    const item = menuById.get(warehouseItemId);
    if (!item) return NextResponse.json({ error: `Item tidak ditemukan di katalog menu (id ${warehouseItemId})` }, { status: 400 });
    if (!Number.isInteger(qty) || qty <= 0) return NextResponse.json({ error: `Qty "${item.name}" harus > 0` }, { status: 400 });
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return NextResponse.json({ error: `Harga "${item.name}" tidak valid` }, { status: 400 });
    lines.push({ warehouseItemId, sku: item.sku, name: item.name, unit: item.unit, qty, unitPrice, subtotal: qty * unitPrice });
  }

  const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
  if (discount > subtotal) return NextResponse.json({ error: "Diskon tidak boleh lebih besar dari subtotal" }, { status: 400 });
  const total = subtotal - discount;

  const arAccount = await prisma.account.findUnique({ where: { code: branch.arCode } });
  const salesAccount = await prisma.account.findUnique({ where: { code: branch.salesCode } });
  if (!arAccount || !salesAccount) {
    return NextResponse.json({ error: `Akun COA utk cabang ${branch.name} belum lengkap - hubungi developer.` }, { status: 500 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const number = await nextInvoiceNumber(tx, branch.code, invoiceDate);
      const invoice = await tx.invoice.create({
        data: {
          number,
          branchCode: branch.code,
          invoiceDate,
          customerName,
          customerPhone,
          customerAddress,
          notes,
          subtotal,
          discount,
          total,
          createdById: user.id,
          lines: { create: lines },
        },
      });
      const entry = await postJournalEntry(
        {
          date: invoiceDate,
          memo: `Invoice ${number} - ${customerName}`,
          sourceType: "INVOICE",
          sourceId: String(invoice.id),
          outletName: branch.name,
          createdById: user.id,
          lines: [
            { accountId: arAccount.id, debit: total, outletName: branch.name, description: `Piutang invoice ${number}` },
            { accountId: salesAccount.id, credit: total, outletName: branch.name, description: `Penjualan invoice ${number}` },
          ],
        },
        tx
      );
      return tx.invoice.update({ where: { id: invoice.id }, data: { journalEntryId: entry.id }, include: { lines: true } });
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof AccountingPostingError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
