"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCheck, CheckCircle2, Circle, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { buildWaLink } from "@/lib/whatsapp";

export type OfferCandidate = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  preferredOutlet: string | null;
  offerDocumentReady: boolean;
  offerWhatsappSent: boolean;
  jobPosting: { title: string };
};

function buildOfferLetter(c: OfferCandidate): string {
  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  return `SURAT PENAWARAN KERJA

Tanggal: ${today}

Kepada Yth.
${c.name}
${c.address ?? "[alamat belum diisi kandidat]"}

Dengan hormat,

Sehubungan dengan proses seleksi yang telah Anda ikuti, dengan ini kami dari HRD Crackling menyampaikan bahwa Anda dinyatakan LOLOS dan kami tawarkan untuk bergabung dengan Crackling pada posisi:

Posisi      : ${c.jobPosting.title}
Penempatan  : ${c.preferredOutlet ?? "[lokasi/cabang belum diisi]"}
No. HP      : ${c.phone ?? "-"}

[Lengkapi bagian ini sebelum dokumen dipakai resmi: gaji yang ditawarkan, tanggal mulai kerja, masa percobaan, dan ketentuan lain sesuai kebijakan perusahaan.]

Mohon konfirmasi kesediaan Anda dengan membalas surat ini atau menghubungi HRD Crackling.

Hormat kami,
Tim HRD Crackling`;
}

function buildOfferWaMessage(c: OfferCandidate): string {
  return `Halo ${c.name}, kami dari HRD Crackling ingin menyampaikan kabar baik - Anda dinyatakan LOLOS seleksi untuk posisi ${c.jobPosting.title}. Kami akan mengirimkan surat penawaran kerja untuk Anda pelajari. Mohon konfirmasi kesediaan Anda ya. Terima kasih.`;
}

export function OfferChecklistDialog({ candidate, onChanged }: { candidate: OfferCandidate; onChanged: () => void }) {
  const [letter, setLetter] = useState(() => buildOfferLetter(candidate));
  const [saving, setSaving] = useState(false);

  async function setFlag(field: "offerDocumentReady" | "offerWhatsappSent", value: boolean) {
    setSaving(true);
    const res = await fetch(`/api/candidates/${candidate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setSaving(false);
    if (res.ok) {
      onChanged();
    } else {
      const err = await res.json();
      toast.error("Gagal: " + err.error);
    }
  }

  function copyLetter() {
    navigator.clipboard.writeText(letter);
    toast.success("Teks surat penawaran disalin.");
  }

  function openWhatsapp() {
    if (!candidate.phone) {
      toast.error("Kandidat tidak punya No. HP tersimpan.");
      return;
    }
    window.open(buildWaLink(candidate.phone, buildOfferWaMessage(candidate)), "_blank");
  }

  const bothDone = candidate.offerDocumentReady && candidate.offerWhatsappSent;

  return (
    <Dialog>
      <DialogTrigger
        title="Checklist penawaran"
        className={`inline-flex items-center gap-1 text-xs transition-colors ${
          bothDone ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <ClipboardCheck className="h-3.5 w-3.5" />
        {(candidate.offerDocumentReady ? 1 : 0) + (candidate.offerWhatsappSent ? 1 : 0)}/2
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Checklist Penawaran - {candidate.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5">
          <div className="grid gap-2">
            <p className="text-sm font-medium flex items-center gap-1.5">
              {candidate.offerDocumentReady ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              1. Surat Penawaran / Kontrak
            </p>
            <p className="text-xs text-muted-foreground">
              Draf terisi otomatis dari data lamaran (nama, alamat, No. HP, posisi, lokasi). Lengkapi gaji &amp; tanggal mulai
              sebelum dipakai resmi, lalu tandai selesai.
            </p>
            <Textarea value={letter} onChange={(e) => setLetter(e.target.value)} rows={10} className="font-mono text-xs" />
            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="outline" size="sm" onClick={copyLetter}>
                <Copy className="h-3.5 w-3.5" /> Salin Teks
              </Button>
              <Button type="button" size="sm" disabled={saving} onClick={() => setFlag("offerDocumentReady", !candidate.offerDocumentReady)}>
                {candidate.offerDocumentReady ? "Batalkan Tanda Selesai" : "Tandai Dokumen Sudah Dibuat"}
              </Button>
            </div>
          </div>

          <div className="grid gap-2 border-t pt-4">
            <p className="text-sm font-medium flex items-center gap-1.5">
              {candidate.offerWhatsappSent ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              2. Kirim Penawaran via WhatsApp
            </p>
            <p className="text-xs text-muted-foreground">
              Buka WhatsApp ke {candidate.phone ?? "(No. HP kandidat belum ada)"} dengan pesan yang sudah siap kirim.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="outline" size="sm" onClick={openWhatsapp}>
                <MessageCircle className="h-3.5 w-3.5" /> Buka WhatsApp
              </Button>
              <Button type="button" size="sm" disabled={saving} onClick={() => setFlag("offerWhatsappSent", !candidate.offerWhatsappSent)}>
                {candidate.offerWhatsappSent ? "Batalkan Tanda Terkirim" : "Tandai Sudah Dikirim"}
              </Button>
            </div>
          </div>

          <p className={`text-xs ${bothDone ? "text-primary" : "text-muted-foreground"}`}>
            {bothDone
              ? "Kedua langkah selesai - kandidat sudah bisa dipindahkan ke tahap Diterima."
              : "Selesaikan kedua langkah di atas dulu sebelum bisa memindahkan kandidat ke tahap Diterima."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
