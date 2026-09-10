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
import { ArrowLeft, Plus } from "lucide-react";

const STAGES = [
  { value: "applied", label: "Melamar" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Penawaran" },
  { value: "hired", label: "Diterima" },
  { value: "rejected", label: "Ditolak" },
];
const stageLabel = (v: string) => STAGES.find((s) => s.value === v)?.label ?? v;

type Candidate = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  notes: string | null;
  stage: string;
  createdAt: string;
};
type Posting = {
  id: number;
  title: string;
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

  if (loading) return <p className="text-sm text-muted-foreground">Memuat...</p>;
  if (!posting) return <p className="text-sm text-muted-foreground">Lowongan tidak ditemukan.</p>;

  return (
    <div className="max-w-4xl grid gap-6">
      <div>
        <Link href="/hr/rekrutmen" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Rekrutmen
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-heading font-semibold tracking-tight">{posting.title}</h1>
          <Badge variant={posting.status === "open" ? "default" : "secondary"}>
            {posting.status === "open" ? "Dibuka" : "Ditutup"}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          {[posting.department, posting.location, posting.employmentType].filter(Boolean).join(" · ") || "-"}
        </p>
        {posting.description && <p className="text-sm mt-2 max-w-2xl">{posting.description}</p>}
      </div>

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
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Kontak</TableHead>
              <TableHead>Sumber</TableHead>
              <TableHead>Tahap</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posting.candidates.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-muted-foreground">Belum ada kandidat.</TableCell></TableRow>
            )}
            {posting.candidates.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {[c.email, c.phone].filter(Boolean).join(" · ") || "-"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.source || "-"}</TableCell>
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
      </Card>
    </div>
  );
}
