"use client";

import { useEffect, useState } from "react";
import { RequiredMark } from "@/app/components/RequiredMark";
import { readJson, errorMessage, readErrorMessage } from "@/lib/fetch-json";
import { LoadingState } from "@/app/components/LoadingState";
import { upload } from "@vercel/blob/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Clock3, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { usePortalContext } from "../layout";
import { isSpvPosition } from "@/lib/roles";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";

type OvertimeRequest = {
  id: number;
  date: string;
  reason: string;
  photoUrl: string;
  status: string;
  managerNote: string | null;
  hrNote: string | null;
};

const STATUS_LABEL: Record<string, { label: string; variant: "secondary" | "default" | "destructive" }> = {
  pending_manager: { label: "Menunggu Manager", variant: "secondary" },
  pending_hr: { label: "Menunggu HR", variant: "secondary" },
  approved: { label: "Disetujui", variant: "default" },
  rejected: { label: "Ditolak", variant: "destructive" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function PortalLemburPage() {
  const { employee } = usePortalContext();
  const [requests, setRequests] = useState<OvertimeRequest[] | null>(null);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  function load() {
    setLoadError(null);
    fetch("/api/portal/overtime-requests")
      .then(readJson)
      .then(setRequests)
      .catch((e) => setLoadError(errorMessage(e, "Gagal memuat riwayat pengajuan.")));
  }

  useEffect(load, []);

  if (employee && !isSpvPosition(employee.position)) {
    return <p className="text-sm text-muted-foreground">Fitur Pengajuan Lembur hanya utk posisi SPV.</p>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !reason.trim()) {
      toast.error("Tanggal & keterangan wajib diisi");
      return;
    }
    if (!photoFile) {
      toast.error("Foto pekerjaan wajib dilampirkan");
      return;
    }
    setSubmitting(true);
    try {
      const blob = await upload(photoFile.name, photoFile, {
        access: "public",
        handleUploadUrl: "/api/portal/overtime-upload",
      });
      const res = await fetch("/api/portal/overtime-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, reason: reason.trim(), photoUrl: blob.url }),
      });
      if (res.ok) {
        toast.success("Pengajuan lembur terkirim, menunggu persetujuan Manager.");
        setDate("");
        setReason("");
        setPhotoFile(null);
        load();
      } else {
        toast.error("Gagal: " + (await readErrorMessage(res)));
      }
    } catch (err) {
      toast.error("Gagal upload foto. Periksa koneksi lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl grid gap-6">
      <div>
        <div className="flex items-center gap-2">
          <Clock3 className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Pengajuan Lembur</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-0.5">
          Ajukan rencana lembur - wajib melampirkan foto pekerjaan yang jadi alasan lembur. Butuh persetujuan Manager,
          lalu HR.
        </p>
      </div>

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Tanggal Rencana Lembur<RequiredMark /></Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label>Alasan Perlu Lembur<RequiredMark /></Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Jelaskan pekerjaan yang perlu diselesaikan lembur..." required />
            </div>
            <div className="grid gap-1.5">
              <Label>Foto Pekerjaan<RequiredMark /></Label>
              <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} required />
              {photoFile && <p className="text-xs text-muted-foreground">{photoFile.name}</p>}
            </div>
            <Button type="submit" disabled={submitting} className="justify-self-start">
              <ImagePlus className="h-3.5 w-3.5" /> {submitting ? "Mengirim..." : "Kirim Pengajuan"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Riwayat Pengajuan</h2>
        {loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : requests === null ? (
          <LoadingState variant="section" />
        ) : requests.length === 0 ? (
          <EmptyState icon={Clock3} title="Belum ada pengajuan lembur" />
        ) : (
          <div className="grid gap-2">
            {requests.map((r) => {
              const s = STATUS_LABEL[r.status] ?? { label: r.status, variant: "secondary" as const };
              return (
                <Card key={r.id}>
                  <CardContent className="grid gap-1.5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{fmtDate(r.date)}</p>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{r.reason}</p>
                    {r.status === "rejected" && (r.managerNote || r.hrNote) && (
                      <p className="text-xs text-destructive">Catatan: {r.managerNote || r.hrNote}</p>
                    )}
                    <a href={r.photoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline w-fit">
                      Lihat foto lampiran
                    </a>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
