"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Clock3, Check, X, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "../../components/AuthContext";
import { canDecideOvertimeStage } from "@/lib/roles";

type OvertimeRequest = {
  id: number;
  date: string;
  reason: string;
  photoUrl: string;
  status: string;
  managerNote: string | null;
  hrNote: string | null;
  managerDecisionBy: { name: string } | null;
  hrDecisionBy: { name: string } | null;
  employee: { id: number; name: string; position: string | null; outlet: string | null };
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

export default function LemburApprovalPage() {
  const { user } = useAuthContext();
  const [requests, setRequests] = useState<OvertimeRequest[] | null>(null);
  const [decideTarget, setDecideTarget] = useState<{ req: OvertimeRequest; decision: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function load() {
    fetch("/api/overtime-requests")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setRequests)
      .catch(() => setRequests([]));
  }

  useEffect(load, []);

  async function submitDecision() {
    if (!decideTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/overtime-requests/${decideTarget.req.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: decideTarget.decision, note: note || undefined }),
      });
      if (res.ok) {
        toast.success(decideTarget.decision === "approved" ? "Pengajuan disetujui" : "Pengajuan ditolak");
        setDecideTarget(null);
        setNote("");
        load();
      } else {
        const err = await res.json();
        toast.error("Gagal: " + err.error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const pending = requests?.filter((r) => r.status === "pending_manager" || r.status === "pending_hr") ?? [];
  const decided = requests?.filter((r) => r.status === "approved" || r.status === "rejected") ?? [];

  return (
    <div className="max-w-3xl grid gap-6">
      <div>
        <div className="flex items-center gap-2">
          <Clock3 className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Persetujuan Lembur</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-0.5">
          Pengajuan lembur SPV - approval 2 tahap (Manager, lalu HR). Catatan administratif, tidak mengubah
          perhitungan gaji otomatis.
        </p>
      </div>

      {requests === null ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <>
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Menunggu Keputusan ({pending.length})</h2>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada pengajuan menunggu.</p>
            ) : (
              <div className="grid gap-2">
                {pending.map((r) => {
                  const s = STATUS_LABEL[r.status];
                  const canDecide = !!user && canDecideOvertimeStage(user, r.status);
                  return (
                    <Card key={r.id}>
                      <CardContent className="grid gap-2 py-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm font-medium">
                              {r.employee.name} <span className="text-muted-foreground font-normal">· {r.employee.position ?? "-"} · {r.employee.outlet ?? "-"}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">{fmtDate(r.date)}</p>
                          </div>
                          <Badge variant={s.variant}>{s.label}</Badge>
                        </div>
                        <p className="text-sm">{r.reason}</p>
                        <button type="button" onClick={() => setPreviewUrl(r.photoUrl)} className="inline-flex w-fit items-center gap-1 text-xs text-primary hover:underline">
                          <ImageIcon className="h-3.5 w-3.5" /> Lihat foto lampiran
                        </button>
                        {r.status === "pending_hr" && r.managerDecisionBy && (
                          <p className="text-xs text-muted-foreground">Disetujui Manager: {r.managerDecisionBy.name}</p>
                        )}
                        {canDecide && (
                          <div className="flex gap-2 mt-1">
                            <Button size="sm" onClick={() => setDecideTarget({ req: r, decision: "approved" })}>
                              <Check className="h-3.5 w-3.5" /> Setujui
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setDecideTarget({ req: r, decision: "rejected" })}>
                              <X className="h-3.5 w-3.5" /> Tolak
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {decided.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">Riwayat Diputuskan</h2>
              <div className="grid gap-2">
                {decided.map((r) => {
                  const s = STATUS_LABEL[r.status];
                  return (
                    <Card key={r.id}>
                      <CardContent className="grid gap-1 py-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm font-medium">
                            {r.employee.name} <span className="text-muted-foreground font-normal">· {fmtDate(r.date)}</span>
                          </p>
                          <Badge variant={s.variant}>{s.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{r.reason}</p>
                        {(r.managerNote || r.hrNote) && (
                          <p className="text-xs text-muted-foreground">Catatan: {r.managerNote || r.hrNote}</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={!!decideTarget} onOpenChange={(open) => !open && setDecideTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decideTarget?.decision === "approved" ? "Setujui Pengajuan Lembur" : "Tolak Pengajuan Lembur"}</DialogTitle>
            <DialogDescription>{decideTarget?.req.employee.name} - {decideTarget && fmtDate(decideTarget.req.date)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (opsional)" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDecideTarget(null)} disabled={submitting}>Batal</Button>
            <Button onClick={submitDecision} disabled={submitting} variant={decideTarget?.decision === "rejected" ? "destructive" : "default"}>
              {submitting ? "Menyimpan..." : "Konfirmasi"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Foto Lampiran</DialogTitle>
          </DialogHeader>
          {previewUrl && <img src={previewUrl} alt="Foto lampiran lembur" className="w-full rounded-md" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
