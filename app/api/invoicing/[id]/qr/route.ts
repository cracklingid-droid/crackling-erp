import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, canAccessInvoicing } from "@/lib/current-user";
import { createQrisCharge, MidtransNotConfiguredError } from "@/lib/midtrans";

// Buat/refresh QR pembayaran QRIS dinamis lewat Midtrans. order_id BARU tiap
// panggil (Midtrans menolak order_id yg sama dipakai dua kali) - dipakai jg
// utk "refresh" kalau QR sebelumnya kedaluwarsa (~15 menit default Midtrans).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (!canAccessInvoicing(user)) return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id: Number(id) } });
  if (!invoice) return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 });
  if (invoice.status !== "unpaid") return NextResponse.json({ error: "QR cuma bisa dibuat utk invoice yang belum lunas." }, { status: 400 });

  const orderId = `INV-${invoice.id}-${Date.now()}`;
  try {
    const charge = await createQrisCharge(orderId, invoice.total);
    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        midtransOrderId: charge.orderId,
        midtransQrString: charge.qrString,
        midtransQrImageUrl: charge.qrImageUrl,
        midtransQrExpiresAt: charge.expiresAt,
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof MidtransNotConfiguredError) return NextResponse.json({ error: e.message }, { status: 500 });
    const message = e instanceof Error ? e.message : "Gagal membuat QR pembayaran.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
