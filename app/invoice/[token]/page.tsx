"use client";

import { useEffect, useState, use as usePromise } from "react";
import { FileText, MapPin, CheckCircle2, Clock } from "lucide-react";

type InvoiceLine = { name: string; unit: string; qty: number; unitPrice: number; subtotal: number };
type PublicInvoice = {
  number: string;
  branchName: string;
  invoiceDate: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  notes: string | null;
  lines: InvoiceLine[];
  subtotal: number;
  discount: number;
  total: number;
  status: string;
  paidAt: string | null;
  midtransQrImageUrl: string | null;
  midtransQrExpiresAt: string | null;
};

function fmtRp(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

export default function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = usePromise(params);
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/public/invoice/${token}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) return setError(json.error ?? "Invoice tidak ditemukan");
        setInvoice(json);
      })
      .catch(() => setError("Terjadi kesalahan"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Memuat invoice...</div>;
  }
  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <p className="text-sm text-muted-foreground">{error ?? "Invoice tidak ditemukan"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 py-8 px-4 sm:py-14">
      <div className="max-w-2xl mx-auto">
        {/* "Kertas" invoice - kartu putih dgn shadow, tiru tampilan invoice cetak
            (permintaan Kevin 2026-09-15: "tiru UI seperti paper bagian invoicing"). */}
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="bg-primary text-primary-foreground px-6 py-5 sm:px-8 sm:py-6 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium tracking-wide uppercase opacity-90">
                <FileText className="h-4 w-4" /> Invoice
              </div>
              <p className="font-heading text-xl font-semibold mt-1">Crackling {invoice.branchName}</p>
              <p className="text-sm opacity-80 flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" /> {invoice.branchName}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-sm">{invoice.number}</p>
              <p className="text-xs opacity-80 mt-0.5">{fmtDate(invoice.invoiceDate)}</p>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-8 grid gap-6">
            {invoice.status === "paid" && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" /> Invoice ini sudah LUNAS{invoice.paidAt && ` pada ${fmtDate(invoice.paidAt)}`}.
              </div>
            )}

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Ditagihkan kepada</p>
              <p className="font-medium">{invoice.customerName}</p>
              <p className="text-sm text-muted-foreground">{invoice.customerPhone}</p>
              {invoice.customerAddress && <p className="text-sm text-muted-foreground">{invoice.customerAddress}</p>}
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-muted-foreground text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Item</th>
                    <th className="text-right font-medium px-3 py-2">Qty</th>
                    <th className="text-right font-medium px-3 py-2">Harga</th>
                    <th className="text-right font-medium px-3 py-2 pr-4">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoice.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{l.name} <span className="text-muted-foreground text-xs">/{l.unit}</span></td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.qty}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtRp(l.unitPrice)}</td>
                      <td className="px-3 py-2 pr-4 text-right tabular-nums">{fmtRp(l.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <div className="grid gap-1 text-sm w-full max-w-56">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{fmtRp(invoice.subtotal)}</span></div>
                {invoice.discount > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Diskon</span><span className="tabular-nums">-{fmtRp(invoice.discount)}</span></div>
                )}
                <div className="flex justify-between text-base font-semibold border-t pt-1 mt-1"><span>Total</span><span className="tabular-nums">{fmtRp(invoice.total)}</span></div>
              </div>
            </div>

            {invoice.notes && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Catatan</p>
                <p className="text-sm">{invoice.notes}</p>
              </div>
            )}

            {invoice.status === "unpaid" && invoice.midtransQrImageUrl && (
              <div className="rounded-lg border bg-muted/30 p-4 flex flex-col items-center gap-2 text-center">
                <p className="text-sm font-medium">Scan untuk bayar (QRIS)</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={invoice.midtransQrImageUrl} alt="QR pembayaran QRIS" className="w-48 h-48 bg-white p-2 rounded-md border" />
                <p className="text-lg font-heading font-semibold tabular-nums">{fmtRp(invoice.total)}</p>
                {invoice.midtransQrExpiresAt && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Berlaku sampai {new Date(invoice.midtransQrExpiresAt).toLocaleString("id-ID")}
                  </p>
                )}
              </div>
            )}
            {invoice.status === "unpaid" && !invoice.midtransQrImageUrl && (
              <p className="text-sm text-muted-foreground text-center">QR pembayaran belum tersedia - hubungi kami utk info pembayaran.</p>
            )}
          </div>

          <div className="px-6 py-4 sm:px-8 border-t bg-muted/20 text-center text-xs text-muted-foreground">
            Terima kasih telah berbelanja di Crackling {invoice.branchName}.
          </div>
        </div>
      </div>
    </div>
  );
}
