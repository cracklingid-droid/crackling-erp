import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { postJournalEntry } from "@/lib/accounting-ledger";
import { verifyMidtransSignature } from "@/lib/midtrans";
import { invoiceBranchByCode, MIDTRANS_CLEARING_ACCOUNT_CODE } from "@/lib/invoicing-config";

// Endpoint publik (Midtrans HTTP Notification) - URL ini didaftarkan Kevin
// di dashboard Midtrans (Settings > Configuration > Payment Notification
// URL) begitu MIDTRANS_SERVER_KEY sudah diset. TIDAK ada auth login (Midtrans
// yang memanggil, bukan staff) - keamanannya lewat verifyMidtransSignature
// (signature_key = SHA512(order_id+status_code+gross_amount+ServerKey)),
// bukan cookie session. Posting saat lunas: Dr akun kliring Midtrans
// (1-1015, dana belum cair ke bank sungguhan) / Cr AR-cabang.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.order_id !== "string" || typeof body.signature_key !== "string") {
    return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 });
  }

  if (!verifyMidtransSignature(body)) {
    return NextResponse.json({ error: "Signature tidak valid" }, { status: 403 });
  }

  const invoice = await prisma.invoice.findFirst({ where: { midtransOrderId: body.order_id } });
  if (!invoice) return NextResponse.json({ ok: true, note: "invoice tidak ditemukan, diabaikan" }); // 200 - Midtrans tidak perlu retry

  const status = body.transaction_status as string;
  const isPaid = status === "settlement" || status === "capture";
  if (!isPaid) return NextResponse.json({ ok: true, note: `status "${status}" diabaikan` });

  // Idempoten - notifikasi Midtrans bisa terkirim >1x utk event yang sama.
  if (invoice.status === "paid") return NextResponse.json({ ok: true, note: "sudah lunas sebelumnya" });
  if (invoice.status === "cancelled") return NextResponse.json({ ok: true, note: "invoice sudah dibatalkan, diabaikan" });

  const branch = invoiceBranchByCode(invoice.branchCode);
  if (!branch) return NextResponse.json({ ok: true, note: "cabang tidak dikenali, diabaikan" });

  const [clearingAccount, arAccount] = await Promise.all([
    prisma.account.findUnique({ where: { code: MIDTRANS_CLEARING_ACCOUNT_CODE } }),
    prisma.account.findUnique({ where: { code: branch.arCode } }),
  ]);
  if (!clearingAccount || !arAccount) return NextResponse.json({ ok: true, note: "akun COA belum lengkap, diabaikan" });

  await prisma.$transaction(async (tx) => {
    const entry = await postJournalEntry(
      {
        date: new Date(),
        memo: `Pelunasan invoice ${invoice.number} (Midtrans QRIS) - ${invoice.customerName}`,
        sourceType: "INVOICE_PAYMENT",
        sourceId: String(invoice.id),
        outletName: branch.name,
        lines: [
          { accountId: clearingAccount.id, debit: invoice.total, outletName: branch.name, description: `Pelunasan ${invoice.number} via Midtrans` },
          { accountId: arAccount.id, credit: invoice.total, outletName: branch.name, description: `Pelunasan piutang ${invoice.number}` },
        ],
      },
      tx
    );
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: "paid", paidAt: new Date(), paidMethod: "midtrans_qris", paymentJournalEntryId: entry.id },
    });
  });

  return NextResponse.json({ ok: true });
}
