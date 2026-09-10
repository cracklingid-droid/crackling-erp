"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Users, ArrowRight } from "lucide-react";

type Posting = {
  id: number;
  title: string;
  department: string | null;
  location: string | null;
  employmentType: string | null;
  status: string;
  createdByName: string;
  createdAt: string;
  candidateCount: number;
  hiredCount: number;
};

export default function RekrutmenPage() {
  const [postings, setPostings] = useState<Posting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/job-postings")
      .then((r) => r.json())
      .then(setPostings)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Judul lowongan wajib diisi");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/job-postings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, department, location, employmentType, description }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Lowongan dibuat.");
      setTitle("");
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

  return (
    <div className="max-w-4xl grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Rekrutmen</h1>
          <p className="text-muted-foreground text-sm">Lowongan pekerjaan & pipeline kandidat.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Lowongan Baru
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Buat Lowongan</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Judul Posisi</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Kitchen Staff - Joglo" autoFocus />
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

      {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}

      {!loading && postings.length === 0 && (
        <p className="text-sm text-muted-foreground">Belum ada lowongan. Klik &quot;Lowongan Baru&quot; untuk mulai.</p>
      )}

      <div className="grid gap-3">
        {postings.map((p) => (
          <Link key={p.id} href={`/hr/rekrutmen/${p.id}`}>
            <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <CardContent className="flex items-center justify-between gap-4 py-1">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-semibold">{p.title}</h3>
                    <Badge variant={p.status === "open" ? "default" : "secondary"}>
                      {p.status === "open" ? "Dibuka" : "Ditutup"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {[p.department, p.location, p.employmentType].filter(Boolean).join(" · ") || "-"}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" /> {p.candidateCount} kandidat
                    {p.hiredCount > 0 && <span className="text-primary font-medium">· {p.hiredCount} diterima</span>}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
