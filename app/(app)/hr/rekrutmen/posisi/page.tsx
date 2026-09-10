"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Plus, ArrowRight, FileQuestion } from "lucide-react";

type Position = {
  id: number;
  name: string;
  passingScore: number;
  questionCount: number;
  jobPostingCount: number;
};

export default function PosisiPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [passingScore, setPassingScore] = useState("70");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/positions")
      .then((r) => r.json())
      .then(setPositions)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama posisi wajib diisi");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, passingScore: Number(passingScore) }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Posisi dibuat.");
      setName("");
      setPassingScore("70");
      setShowForm(false);
      load();
    } else {
      const err = await res.json();
      toast.error("Gagal: " + err.error);
    }
  }

  return (
    <div className="max-w-3xl grid gap-6">
      <div>
        <Link href="/hr/rekrutmen" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Rekrutmen
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-semibold tracking-tight">Posisi & Bank Soal Psikotest</h1>
            <p className="text-muted-foreground text-sm">
              Tiap posisi punya soal & ambang nilai lulus sendiri. Dipakai ulang tiap kali lowongan posisi ini dibuka lagi.
            </p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" /> Posisi Baru
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Nama Posisi</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Waiters" autoFocus />
              </div>
              <div className="grid gap-1.5 max-w-40">
                <Label>Ambang Lulus (%)</Label>
                <Input type="number" min={0} max={100} value={passingScore} onChange={(e) => setPassingScore(e.target.value)} />
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
      {!loading && positions.length === 0 && (
        <p className="text-sm text-muted-foreground">Belum ada posisi. Klik &quot;Posisi Baru&quot; untuk mulai.</p>
      )}

      <div className="grid gap-3">
        {positions.map((p) => (
          <Link key={p.id} href={`/hr/rekrutmen/posisi/${p.id}`}>
            <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <CardContent className="flex items-center justify-between gap-4 py-1">
                <div>
                  <h3 className="font-heading font-semibold">{p.name}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Ambang lulus: {p.passingScore}%</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <FileQuestion className="h-4 w-4" /> {p.questionCount} soal
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
