import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { invoiceBranchByCode } from "@/lib/invoicing-config";

// Halaman publik /invoice/[token] (link yang dikirim ke WhatsApp customer,
// tanpa login) - cuma field yang relevan buat customer, TIDAK ada
// journalEntryId/createdById/dll (data internal pembukuan).
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { publicToken: token },
    include: { lines: true },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 });

  const branch = invoiceBranchByCode(invoice.branchCode);

  return NextResponse.json({
    number: invoice.number,
    branchName: branch?.name ?? invoice.branchCode,
    invoiceDate: invoice.invoiceDate,
    customerName: invoice.customerName,
    customerPhone: invoice.customerPhone,
    customerAddress: invoice.customerAddress,
    notes: invoice.notes,
    lines: invoice.lines.map((l) => ({ name: l.name, unit: l.unit, qty: l.qty, unitPrice: l.unitPrice, subtotal: l.subtotal })),
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    total: invoice.total,
    status: invoice.status,
    paidAt: invoice.paidAt,
    midtransQrImageUrl: invoice.status === "unpaid" ? invoice.midtransQrImageUrl : null,
    midtransQrExpiresAt: invoice.midtransQrExpiresAt,
  });
}
