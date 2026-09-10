"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Plus, Copy, Lock, Unlock, FileText } from "lucide-react";
import { formatSlotWIB } from "@/lib/interview-slots";
import { PsychTestResultDialog } from "@/app/components/PsychTestResultDialog";

const STAGES = [
  { value: "applied", label: "Melamar" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Penawaran" },
  { value: "hired", label: "Diterima" },
  { value: "rejected", label: "Ditolak" },
];
const stageLabel = (v: string) => STAGES.find((s) => s.value === v)?.label ?? v;

type PsychTestSubmission = { percentage: number; passed: boolean } | null;
type InterviewSlot = { scheduledAt: string } | null;
type Candidate = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  notes: string | null;
  experience: string | null;
  cvUrl: string | null;
  stage: string;
  createdAt: string;
  psychTestSubmission: PsychTestSubmission;
  interviewSlot: InterviewSlot;
};
type Posting = {
  id: number;
  title: string;
  positionName: string;
  department: string | null;
  location: string | null;
  employmentType: string | null;
  description: string | null;
  status: string;
  candidates: Candidate[];
};

export default function RekrutmenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [posting, setPosting] = useState<Posting | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/api/job-postings/${id}`)
      .then((r) => r.json())
      .then(setPosting)
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function handleAddCandidate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama kandidat wajib diisi");
      return;
    }
    if (!email.trim()) {
      toast.error("Email kandidat wajib diisi supaya bisa menerima hasil psikotest & undangan interview");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobPostingId: Number(id), name, email, phone, source }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Kandidat ditambahkan.");
      setName("");
      setEmail("");
      setPhone("");
      setSource("");
      setShowForm(false);
      load();
    } else {
      const err = await res.json();
      toast.error("Gagal: " + err.error);
    }
  }

  async function handleStageChange(candidateId: number, stage: string) {
    const res = await fetch(`/api/candidates/${candidateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    if (res.ok) {
      toast.success(`Tahap diubah ke "${stageLabel(stage)}".`);
      load();
    } else {
      const err = await res.json();
      toast.error("Gagal: " + err.error);
    }
  }

  async function handleToggleStatus() {
    if (!posting) return;
    const nextStatus = posting.status === "open" ? "closed" : "open";
    setTogglingStatus(true);
    const res = await fetch(`/api/job-postings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setTogglingStatus(false);
    if (res.ok) {
      toast.success(nextStatus === "open" ? "Lowongan dibuka kembali." : "Lowongan ditutup.");
      load();
    } else {
      toast.error("Gagal mengubah status.");
    }
  }

  function copyApplyLink() {
    const url = `${window.location.origin}/lowongan/${id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link lamaran disalin.");
  }

  if (loading) return <p className="text-sm text-muted-foreground">Memuat...</p>;
  if (!posting) return <p className="text-sm text-muted-foreground">Lowongan tidak ditemukan.</p>;

  return (
    <div className="max-w-4xl grid gap-6">
      <div>
        <Link href="/hr/rekrutmen" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Rekrutmen
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-heading font-semibold tracking-tight">{posting.title}</h1>
              <Badge variant={posting.status === "open" ? "default" : "secondary"}>
                {posting.status === "open" ? "Dibuka" : "Ditutup"}
              </Badge>
              <Badge variant="outline" className="font-normal">{posting.positionName}</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {[posting.department, posting.location, posting.employmentType].filter(Boolean).join(" · ") || "-"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleToggleStatus} disabled={togglingStatus}>
            {posting.status === "open" ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
            {posting.status === "open" ? "Tutup Lowongan" : "Buka Kembali"}
          </Button>
        </div>
        {posting.description && <p className="text-sm mt-2 max-w-2xl whitespace-pre-line">{posting.description}</p>}
      </div>

      {posting.status === "open" && (
        <Card>
          <CardContent className="py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Link lamaran publik</p>
              <p className="text-xs text-muted-foreground">Bagikan ke calon pelamar. Nonaktif otomatis kalau lowongan ditutup.</p>
            </div>
            <Button variant="outline" size="sm" onClick={copyApplyLink}>
              <Copy className="h-3.5 w-3.5" /> Salin Link
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Kandidat ({posting.candidates.length})</h2>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-3.5 w-3.5" /> Tambah Kandidat
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kandidat Baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddCandidate} className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Nama</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Email</Label>
                  <Input required value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                </div>
                <div className="grid gap-1.5">
                  <Label>No. HP</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Sumber (opsional)</Label>
                <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="mis. Referral, Walk-in, Job Portal" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Batal</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Kontak</TableHead>
                <TableHead>Pengalaman</TableHead>
                <TableHead>CV</TableHead>
                <TableHead>Psikotest</TableHead>
                <TableHead>Jadwal Interview</TableHead>
                <TableHead>Tahap</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posting.candidates.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-muted-foreground">Belum ada kandidat.</TableCell></TableRow>
              )}
              {posting.candidates.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link href={`/hr/rekrutmen/kandidat/${c.id}`} className="hover:underline">{c.name}</Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[c.email, c.phone].filter(Boolean).join(" · ") || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.experience || "-"}</TableCell>
                  <TableCell className="text-sm">
                    {c.cvUrl ? (
                      <a href={c.cvUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        <FileText className="h-3.5 w-3.5" /> Lihat
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.psychTestSubmission ? (
                      <div className="flex items-center gap-1.5">
                        <Badge variant={c.psychTestSubmission.passed ? "default" : "destructive"} className="font-normal">
                          {c.psychTestSubmission.percentage}% · {c.psychTestSubmission.passed ? "Lulus" : "Tidak lulus"}
                        </Badge>
                        <PsychTestResultDialog candidateId={c.id} />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Belum test</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.interviewSlot ? (
                      <>
                        {formatSlotWIB(new Date(c.interviewSlot.scheduledAt)).tanggal}
                        <br />
                        {formatSlotWIB(new Date(c.interviewSlot.scheduledAt)).jam}
                      </>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <Select value={c.stage} onValueChange={(v) => v && handleStageChange(c.id, v)}>
                      <SelectTrigger className="w-40">
                        <SelectValue>{() => stageLabel(c.stage)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
