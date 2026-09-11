"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus, Users, ArrowRight, ListChecks, Briefcase, AlertTriangle, CalendarClock,
  FileCheck2, UserPlus, Handshake, PartyPopper, XCircle,
} from "lucide-react";
import { formatSlotWIB } from "@/lib/interview-slots";
import { PsychTestResultDialog } from "@/app/components/PsychTestResultDialog";
import { OfferChecklistDialog } from "@/app/components/OfferChecklistDialog";
import { allowedNextStages } from "@/lib/candidate-stages";

type Posting = {
  id: number;
  title: string;
  positionId: number;
  positionName: string;
  department: string | null;
  location: string | null;
  employmentType: string | null;
  status: string;
  createdByName: string;
  createdAt: string;
  candidateCount: number;
  hiredCount: number;
};
type Position = { id: number; name: string };

type Candidate = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  preferredOutlet: string | null;
  stage: string;
  createdAt: string;
  offerDocumentReady: boolean;
  offerWhatsappSent: boolean;
  jobPosting: { id: number; title: string; status: string };
  psychTestSubmission: { percentage: number; passed: boolean } | null;
  interviewSlot: { scheduledAt: string } | null;
};

const STAGES = [
  { value: "applied", label: "Melamar", tile: "icon-tile-4", icon: UserPlus },
  { value: "screening", label: "Lolos Test", tile: "icon-tile-2", icon: FileCheck2 },
  { value: "interview", label: "Interview", tile: "icon-tile-3", icon: CalendarClock },
  { value: "offer", label: "Penawaran", tile: "icon-tile-5", icon: Handshake },
  { value: "hired", label: "Diterima", tile: "icon-tile-1", icon: PartyPopper },
  { value: "rejected", label: "Ditolak", tile: "bg-destructive/10 text-destructive", icon: XCircle },
] as const;
const stageLabel = (v: string) => STAGES.find((s) => s.value === v)?.label ?? v;

function CandidateCard({ c, onChanged }: { c: Candidate; onChanged: () => void }) {
  async function handleStageChange(stage: string) {
    const res = await fetch(`/api/candidates/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    if (res.ok) {
      toast.success(`${c.name} dipindah ke "${stageLabel(stage)}".`);
      onChanged();
    } else {
      const err = await res.json();
      toast.error("Gagal: " + err.error);
    }
  }

  return (
    <Card className="shadow-none min-w-0">
      <CardContent className="p-3 grid gap-2 min-w-0">
        <div className="min-w-0">
          <Link href={`/hr/rekrutmen/kandidat/${c.id}`} className="block truncate font-medium text-sm hover:underline">
            {c.name}
          </Link>
          <p className="text-xs text-muted-foreground truncate">{c.jobPosting.title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {c.psychTestSubmission && (
            <>
              <Badge variant={c.psychTestSubmission.passed ? "default" : "destructive"} className="font-normal text-[10px]">
                Test {c.psychTestSubmission.percentage}%
              </Badge>
              <PsychTestResultDialog candidateId={c.id} size="h-3.5 w-3.5" />
            </>
          )}
          {c.interviewSlot && (
            <Badge variant="outline" className="font-normal text-[10px]">
              {formatSlotWIB(new Date(c.interviewSlot.scheduledAt)).tanggal.split(",")[0]}, {formatSlotWIB(new Date(c.interviewSlot.scheduledAt)).jam}
            </Badge>
          )}
          {c.stage === "offer" && <OfferChecklistDialog candidate={c} onChanged={onChanged} />}
        </div>
        <Select value={c.stage} onValueChange={(v) => v && handleStageChange(v)}>
          <SelectTrigger className="h-7 min-w-0 w-full text-xs">
            <SelectValue className="truncate">{() => stageLabel(c.stage)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STAGES.filter((s) => allowedNextStages(c.stage).includes(s.value)).map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

export default function RekrutmenPage() {
  const [postings, setPostings] = useState<Posting[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [positionId, setPositionId] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/job-postings").then((r) => r.json()),
      fetch("/api/candidates").then((r) => r.json()),
    ])
      .then(([p, c]) => {
        setPostings(p);
        setCandidates(c);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);
  useEffect(() => {
    fetch("/api/positions")
      .then((r) => r.json())
      .then(setPositions);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Judul lowongan wajib diisi");
      return;
    }
    if (!positionId) {
      toast.error("Posisi wajib dipilih");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/job-postings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, positionId: Number(positionId), department, location, employmentType, description }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Lowongan dibuat.");
      setTitle("");
      setPositionId("");
      setDepartment("");
      setLocation("");
      setEmploymentType("");
      setDescription("");
      setShowForm(false);
      load();
    } else {
      const err = await res.json();
      toast.error("Gagal: " + err.error);
    }
  }

  const now = Date.now();
  const needsFollowUp = useMemo(
    () => candidates.filter((c) => c.stage === "interview" && c.interviewSlot && new Date(c.interviewSlot.scheduledAt).getTime() < now),
    [candidates, now]
  );
  const upcomingInterviews = useMemo(
    () =>
      candidates
        .filter((c) => c.interviewSlot && new Date(c.interviewSlot.scheduledAt).getTime() >= now)
        .sort((a, b) => new Date(a.interviewSlot!.scheduledAt).getTime() - new Date(b.interviewSlot!.scheduledAt).getTime())
        .slice(0, 6),
    [candidates, now]
  );
  const activeCandidates = candidates.filter((c) => c.stage !== "hired" && c.stage !== "rejected");
  const openPostings = postings.filter((p) => p.status === "open");

  const columns = STAGES.map((s) => ({ ...s, items: candidates.filter((c) => c.stage === s.value) }));

  return (
    <div className="max-w-7xl grid gap-6 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Rekrutmen</h1>
          <p className="text-muted-foreground text-sm">Pusat kendali proses rekrutmen - dari lamaran sampai onboarding.</p>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          <Link href="/hr/rekrutmen/posisi" className="flex-1 sm:flex-none">
            <Button variant="outline" className="w-full sm:w-auto whitespace-nowrap">
              <ListChecks className="h-4 w-4" /> Posisi &amp; Soal
            </Button>
          </Link>
          <Button onClick={() => setShowForm((v) => !v)} className="flex-1 sm:flex-none whitespace-nowrap">
            <Plus className="h-4 w-4" /> Lowongan Baru
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <>
          {/* Stat cards */}
          <div className="min-w-0 grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-3 py-1">
                <div className="icon-tile-4 flex h-10 w-10 items-center justify-center rounded-lg shrink-0"><Briefcase className="h-5 w-5" /></div>
                <div>
                  <p className="text-2xl font-heading font-semibold tabular-nums">{openPostings.length}</p>
                  <p className="text-xs text-muted-foreground">Lowongan Dibuka</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 py-1">
                <div className="icon-tile-2 flex h-10 w-10 items-center justify-center rounded-lg shrink-0"><Users className="h-5 w-5" /></div>
                <div>
                  <p className="text-2xl font-heading font-semibold tabular-nums">{activeCandidates.length}</p>
                  <p className="text-xs text-muted-foreground">Kandidat Aktif</p>
                </div>
              </CardContent>
            </Card>
            <Card className={needsFollowUp.length > 0 ? "border-destructive/40" : ""}>
              <CardContent className="flex items-center gap-3 py-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0 bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" /></div>
                <div>
                  <p className="text-2xl font-heading font-semibold tabular-nums">{needsFollowUp.length}</p>
                  <p className="text-xs text-muted-foreground">Perlu Ditindaklanjuti</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 py-1">
                <div className="icon-tile-3 flex h-10 w-10 items-center justify-center rounded-lg shrink-0"><CalendarClock className="h-5 w-5" /></div>
                <div>
                  <p className="text-2xl font-heading font-semibold tabular-nums">{upcomingInterviews.length}</p>
                  <p className="text-xs text-muted-foreground">Interview Terjadwal</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Perlu Ditindaklanjuti + Jadwal Interview + Lowongan Aktif */}
          <div className="min-w-0 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card className={needsFollowUp.length > 0 ? "border-destructive/40" : ""}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" /> Perlu Ditindaklanjuti
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {needsFollowUp.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada. Semua kandidat sudah ditindaklanjuti.</p>}
                {needsFollowUp.map((c) => (
                  <Link key={c.id} href={`/hr/rekrutmen/kandidat/${c.id}`} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">Interview selesai, belum diputuskan · {c.jobPosting.title}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" /> Jadwal Interview Mendatang
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {upcomingInterviews.length === 0 && <p className="text-sm text-muted-foreground">Belum ada jadwal interview mendatang.</p>}
                {upcomingInterviews.map((c) => {
                  const { tanggal, jam } = formatSlotWIB(new Date(c.interviewSlot!.scheduledAt));
                  return (
                    <Link key={c.id} href={`/hr/rekrutmen/kandidat/${c.id}`} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{tanggal} · {jam}</p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </Link>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> Lowongan Aktif
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {openPostings.length === 0 && <p className="text-sm text-muted-foreground">Belum ada lowongan dibuka.</p>}
                {openPostings.map((p) => (
                  <Link key={p.id} href={`/hr/rekrutmen/${p.id}`} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.candidateCount} kandidat · {p.positionName}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Kanban pipeline */}
          <div className="min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading font-semibold">Pipeline Kandidat</h2>
            </div>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {columns.map((col) => {
                const Icon = col.icon;
                return (
                  <div
                    key={col.value}
                    className="grid gap-3 content-start rounded-xl border border-border/60 bg-muted/20 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`${col.tile} flex h-7 w-7 items-center justify-center rounded-md shrink-0`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <p className="text-sm font-medium">{col.label}</p>
                      <span className="ml-auto rounded-full border border-border/60 bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                        {col.items.length}
                      </span>
                    </div>
                    <div className="thin-scrollbar grid gap-2 max-h-[32rem] overflow-y-auto pr-1 -mr-1">
                      {col.items.length === 0 && (
                        <div className="rounded-lg border border-dashed border-border/70 py-6 text-center text-xs text-muted-foreground">
                          Kosong
                        </div>
                      )}
                      {col.items.map((c) => (
                        <CandidateCard key={c.id} c={c} onChanged={load} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Buat Lowongan</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 max-w-xl">
              <div className="grid gap-1.5">
                <Label>Judul Lowongan</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Kitchen Staff - Joglo" autoFocus />
              </div>
              <div className="grid gap-1.5">
                <Label>Posisi (menentukan bank soal psikotest)</Label>
                {positions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Belum ada posisi.{" "}
                    <Link href="/hr/rekrutmen/posisi" className="text-primary underline">
                      Buat posisi dulu di sini
                    </Link>
                    .
                  </p>
                ) : (
                  <Select value={positionId} onValueChange={(v) => v && setPositionId(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih posisi..." />
                    </SelectTrigger>
                    <SelectContent>
                      {positions.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Departemen / Outlet</Label>
                  <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="mis. Kitchen - Joglo" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Lokasi</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="mis. Gading Serpong" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Tipe Kerja</Label>
                <Input value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} placeholder="mis. Full-time" />
              </div>
              <div className="grid gap-1.5">
                <Label>Deskripsi (opsional)</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Batal</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
