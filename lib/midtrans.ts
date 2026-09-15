import crypto from "crypto";

// Integrasi Midtrans Core API utk QRIS dinamis (modul Invoicing, permintaan
// Kevin 2026-09-15, diganti dari Xendit ke Midtrans di percakapan yang
// sama). Server Key didaftarkan Kevin sendiri di dashboard Midtrans (Settings
// > Access Keys) - env MIDTRANS_SERVER_KEY belum diset di server manapun
// per 2026-09-15, jadi bagian ini BELUM BISA DITES sampai Kevin bikin akun &
// pasang key-nya (pola sama spt ANTHROPIC_API_KEY sebelumnya).
//
// Env yang dibutuhkan:
//   MIDTRANS_SERVER_KEY     - wajib, dari dashboard Midtrans
//   MIDTRANS_IS_PRODUCTION  - "true" utk akun production, kosong/apa pun
//                             selain "true" = pakai sandbox (default aman)

export class MidtransNotConfiguredError extends Error {
  constructor() {
    super("Fitur QR pembayaran belum aktif (MIDTRANS_SERVER_KEY belum diset di server).");
  }
}

function baseUrl(): string {
  return process.env.MIDTRANS_IS_PRODUCTION === "true" ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
}

function authHeader(): string {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key) throw new MidtransNotConfiguredError();
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

export type MidtransQrCharge = {
  orderId: string;
  qrString: string | null;
  qrImageUrl: string | null;
  expiresAt: Date | null;
};

// 1 order_id Midtrans = 1 percobaan bayar. Dipanggil ulang (mis. QR
// kedaluwarsa) = order_id BARU (lihat pemanggil, nambah suffix -R2 dst) -
// Midtrans menolak charge dgn order_id yang sama persis dua kali.
export async function createQrisCharge(orderId: string, amountRupiah: number): Promise<MidtransQrCharge> {
  const res = await fetch(`${baseUrl()}/v2/charge`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      payment_type: "qris",
      transaction_details: { order_id: orderId, gross_amount: Math.round(amountRupiah) },
      qris: { acquirer: "gopay" },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data?.status_message === "string" ? data.status_message : `Midtrans menolak permintaan (HTTP ${res.status}).`;
    throw new Error(`Gagal membuat QR pembayaran: ${message}`);
  }

  const qrAction = Array.isArray(data.actions) ? data.actions.find((a: { name?: string }) => a.name === "generate-qr-code") : null;

  return {
    orderId,
    qrString: typeof data.qr_string === "string" ? data.qr_string : null,
    qrImageUrl: typeof qrAction?.url === "string" ? qrAction.url : null,
    expiresAt: typeof data.expiry_time === "string" ? new Date(data.expiry_time.replace(" ", "T") + "+07:00") : null,
  };
}

// Verifikasi notifikasi (webhook) Midtrans: signature_key HARUS =
// SHA512(order_id + status_code + gross_amount + ServerKey) - lihat dok
// Midtrans "HTTP Notification". Menolak notifikasi palsu yang bukan dari
// Midtrans (siapa pun bisa POST ke URL webhook, wajib diverifikasi sebelum
// dipercaya menandai invoice lunas).
export function verifyMidtransSignature(body: { order_id: string; status_code: string; gross_amount: string; signature_key: string }): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return false;
  const expected = crypto
    .createHash("sha512")
    .update(body.order_id + body.status_code + body.gross_amount + serverKey)
    .digest("hex");
  return expected === body.signature_key;
}
