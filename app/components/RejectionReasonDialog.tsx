"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// Dialog kecil yang muncul begitu HR memilih tahap "Ditolak" di dropdown
// manapun (Kanban, tabel lowongan, detail kandidat) - alasan tersimpan lewat
// mekanisme `stageNote` yang sudah ada (CandidateStageEvent.note, tampil di
// "Riwayat Tahap"), supaya kelak bisa dipakai evaluasi funnel rekrutmen
// (kenapa kandidat-kandidat gagal). Dikontrol dari luar (`open`/`onOpenChange`)
// karena dropdown Select-nya sendiri tidak boleh langsung pindah tahap
// sebelum alasan diisi/dilewati. Permintaan Kevin 2026-09-17.
export function RejectionReasonDialog({
  candidateName,
  open,
  onOpenChange,
  onConfirm,
}: {
  candidateName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    setSaving(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (saving) return;
        onOpenChange(v);
        if (!v) setReason("");
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tolak Kandidat - {candidateName}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label>Alasan Ditolak (opsional)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="mis. tidak sesuai kualifikasi, gagal psikotest, mengundurkan diri, dst."
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Tersimpan di Riwayat Tahap kandidat - berguna untuk evaluasi rekrutmen ke depan.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={saving}>
            {saving ? "Menolak..." : "Tolak Kandidat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
