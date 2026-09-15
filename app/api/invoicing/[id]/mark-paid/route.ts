import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessInvoicing } from "@/lib/current-user";
import { postJournalEntry, AccountingPostingError } from "@/lib/accounting-ledger";
import { invoiceBranchByCode } from "@/lib/invoicing-config";

// Tandai lunas MANUAL (staff konfirmasi sendiri, mis. customer kirim bukti
// transfer lewat WA) - dipakai selama Midtrans belum aktif/webhook belum
// jalan, atau utk pembayaran di luar QR (transfer manual dsb). Posting: Dr
// akun Kas/Bank yang dipilih, Cr AR-cabang (melunasi piutang invoice ini).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessInvoicing(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const bankAccountId = Number(body.bankAccountId);
  if (!Number.isInteger(bankAccountId)) return NextResponse.json({ error: "Pilih akun Kas/Bank tujuan dulu" }, { status: 400 });

  const invoice = await prisma.invoice.findUnique({ where: { id: Number(id) } });
  if (!invoice) return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 });
  if (invoice.status !== "unpaid") return NextResponse.json({ error: "Invoice ini tidak dalam status belum lunas." }, { status: 400 });

  const branch = invoiceBranchByCode(invoice.branchCode);
  if (!branch) return NextResponse.json({ error: "Cabang invoice tidak dikenali" }, { status: 500 });

  const bankAccount = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
  if (!bankAccount) return NextResponse.json({ error: "Akun Kas/Bank tidak ditemukan" }, { status: 400 });
  const arAccount = await prisma.account.findUnique({ where: { code: branch.arCode } });
  if (!arAccount) return NextResponse.json({ error: `Akun AR cabang ${branch.name} belum ada di COA.` }, { status: 500 });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const entry = await postJournalEntry(
        {
          date: new Date(),
          memo: `Pelunasan invoice ${invoice.number} (manual) - ${invoice.customerName}`,
          sourceType: "INVOICE_PAYMENT",
          sourceId: String(invoice.id),
          outletName: branch.name,
          createdById: user.id,
          lines: [
            { accountId: bankAccount.accountId, debit: invoice.total, outletName: branch.name, description: `Pelunasan ${invoice.number}` },
            { accountId: arAccount.id, credit: invoice.total, outletName: branch.name, description: `Pelunasan piutang ${invoice.number}` },
          ],
        },
        tx
      );
      return tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "paid",
          paidAt: new Date(),
          paidMethod: "manual",
          paidBankAccountId: bankAccount.id,
          paidById: user.id,
          paymentJournalEntryId: entry.id,
        },
      });
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof AccountingPostingError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
