"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Pencil, X, Check } from "lucide-react";

type Option = { id?: number; label: string; score: number };
type Question = { id: number; text: string; order: number; options: Option[] };
type Position = { id: number; name: string; passingScore: number; questions: Question[] };

function OptionEditor({
  options,
  setOptions,
}: {
  options: Option[];
  setOptions: (o: Option[]) => void;
}) {
  return (
    <div className="grid gap-2">
      {options.map((o, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            className="flex-1"
            placeholder={`Opsi ${i + 1}`}
            value={o.label}
            onChange={(e) => {
              const next = [...options];
              next[i] = { ...next[i], label: e.target.value };
              setOptions(next);
            }}
          />
          <Input
            type="number"
            className="w-24"
            placeholder="Skor"
            value={o.score}
            onChange={(e) => {
              const next = [...options];
              next[i] = { ...next[i], score: Number(e.target.value) };
              setOptions(next);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={options.length <= 2}
            onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setOptions([...options, { label: "", score: 0 }])}>
        <Plus className="h-3.5 w-3.5" /> Tambah Opsi
      </Button>
    </div>
  );
}

function NewQuestionForm({ positionId, onSaved }: { positionId: number; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<Option[]>([
    { label: "", score: 0 },
    { label: "", score: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return toast.error("Pertanyaan wajib diisi");
    if (options.some((o) => !o.label.trim())) return toast.error("Semua opsi wajib diisi");
    setSaving(true);
    const res = await fetch(`/api/positions/${positionId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, options }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Soal ditambahkan.");
      setText("");
      setOptions([{ label: "", score: 0 }, { label: "", score: 0 }]);
      onSaved();
    } else {
      const err = await res.json();
      toast.error("Gagal: " + err.error);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tambah Soal</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Pertanyaan</Label>
            <Input value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label>Opsi Jawaban &amp; Skor</Label>
            <OptionEditor options={options} setOptions={setOptions} />
          </div>
          <Button type="submit" disabled={saving} className="w-fit">{saving ? "Menyimpan..." : "Simpan Soal"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function QuestionRow({ q, onChanged }: { q: Question; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(q.text);
  const [options, setOptions] = useState<Option[]>(q.options);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!text.trim()) return toast.error("Pertanyaan wajib diisi");
    if (options.some((o) => !o.label.trim())) return toast.error("Semua opsi wajib diisi");
    setSaving(true);
    const res = await fetch(`/api/questions/${q.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, options }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Soal diperbarui.");
      setEditing(false);
      onChanged();
    } else {
      const err = await res.json();
      toast.error("Gagal: " + err.error);
    }
  }

  async function handleDelete() {
    if (!confirm("Hapus soal ini?")) return;
    const res = await fetch(`/api/questions/${q.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Soal dihapus.");
      onChanged();
    } else {
      const err = await res.json();
      toast.error("Gagal: " + (err.error ?? "tidak diketahui"));
    }
  }

  if (editing) {
    return (
      <Card>
        <CardContent className="pt-6 grid gap-4">
          <div className="grid gap-1.5">
            <Label>Pertanyaan</Label>
            <Input value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Opsi Jawaban &amp; Skor</Label>
            <OptionEditor options={options} setOptions={setOptions} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}><Check className="h-3.5 w-3.5" /> Simpan</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Batal</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <p className="font-medium">{q.text}</p>
          <div className="flex gap-1 shrink-0">
            <Button size="icon" variant="ghost" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {q.options.map((o, i) => (
            <Badge key={i} variant="secondary" className="font-normal">
              {o.label} · {o.score}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PosisiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);
  const [passingScore, setPassingScore] = useState("70");
  const [savingScore, setSavingScore] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/api/positions/${id}`)
      .then((r) => r.json())
      .then((p) => {
        setPosition(p);
        setPassingScore(String(p.passingScore));
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function handleSaveScore() {
    setSavingScore(true);
    const res = await fetch(`/api/positions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passingScore: Number(passingScore) }),
    });
    setSavingScore(false);
    if (res.ok) {
      toast.success("Ambang lulus diperbarui.");
      load();
    } else {
      toast.error("Gagal menyimpan.");
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Memuat...</p>;
  if (!position) return <p className="text-sm text-muted-foreground">Posisi tidak ditemukan.</p>;

  const maxScore = position.questions.reduce(
    (sum, q) => sum + Math.max(0, ...q.options.map((o) => o.score), 0),
    0
  );

  return (
    <div className="max-w-3xl grid gap-6">
      <div>
        <Link href="/hr/rekrutmen/posisi" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Posisi
        </Link>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">{position.name}</h1>
        <p className="text-muted-foreground text-sm">
          {position.questions.length} soal · skor maksimum {maxScore}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 flex items-end gap-3">
          <div className="grid gap-1.5 w-40">
            <Label>Ambang Lulus (%)</Label>
            <Input type="number" min={0} max={100} value={passingScore} onChange={(e) => setPassingScore(e.target.value)} />
          </div>
          <Button onClick={handleSaveScore} disabled={savingScore}>{savingScore ? "Menyimpan..." : "Simpan"}</Button>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {position.questions.map((q) => (
          <QuestionRow key={q.id} q={q} onChanged={load} />
        ))}
      </div>

      <NewQuestionForm positionId={position.id} onSaved={load} />
    </div>
  );
}
