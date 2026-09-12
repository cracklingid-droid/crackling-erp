"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Plus, Lock } from "lucide-react";
import { getDefaultPeriodRange, toDateInputValue } from "@/lib/payroll-period-cycle";
import { nextOutletPeriodRange, outletPeriodLabel } from "@/lib/payroll-outlet-schedule";

const CATEGORY_LABEL: Record<string, string> = { outlet: "Outlet", kantor: "Kantor" };

type Period = {
  id: number;
  label: string;
  startDate: string;
  endDate: string;
  status: string;
  _count: { items: number };
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// Label default pakai bulan tanggal akhir siklus (mis. siklus 21 Agu - 20
// Sep dilabeli "September") karena itu bulan gajiannya (tanggal 25).
function defaultPeriodLabel(category: string, end: Date) {
  const monthLabel = end.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  return `Gaji ${CATEGORY_LABEL[category] ?? category} ${monthLabel}`;
}

export default function PayrollCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = usePromise(params);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const categoryLabel = CATEGORY_LABEL[category] ?? category;
  const valid = category === "outlet" || category === "kantor";

  function load() {
    if (!valid) return;
    setLoading(true);
    fetch(`/api/payroll/periods?category=${category}`)
      .then((r) => r.json())
      .then(setPeriods)
      .finally(() => setLoading(false));
  }

  useEffect(load, [category]);

  // Payroll Outlet: tanggal & label TIDAK bisa dikustomisasi lagi - ikut
  // jadwal tetap dari pengumuman Kevin di grup, dihitung dari periode
  // outlet terakhir yang sudah ada (bukan dari tanggal hari ini seperti
  // Kantor). Keputusan Kevin 2026-09-12, supaya tidak ada ruang salah
  // input tanggal dari HR.
  const lastOutletPeriod = category === "outlet" ? periods[0] : undefined;
  const nextOutletRange =
    category === "outlet" && lastOutletPeriod ? nextOutletPeriodRange(new Date(lastOutletPeriod.endDate)) : null;

  function openForm() {
    if (!showForm && category === "kantor") {
      const { start, end } = getDefaultPeriodRange();
      setLabel(defaultPeriodLabel(category, end));
      setStartDate(toDateInputValue(start));
      setEndDate(toDateInputValue(end));
    }
    setShowForm((v) => !v);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (category === "kantor" && (!label.trim() || !startDate || !endDate)) {
      toast.error("Label dan rentang tanggal wajib diisi");
      return;
    }
    setSaving(true);
    const body = category === "outlet" ? { category } : { label, category, startDate, endDate };
    const res = await fetch("/api/payroll/periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      const created = await res.json();
      toast.success("Periode gaji dibuat.");
      setShowForm(false);
      load();
      window.location.href = `/hr/payroll/${category}/${created.id}`;
    } else {
      const err = await res.json();
      toast.error("Gagal: " + err.error);
    }
  }

  if (!valid) {
    return <p className="text-sm text-muted-foreground">Kategori payroll tidak ditemukan.</p>;
  }

  return (
    <div className="max-w-3xl grid gap-6">
      <div>
        <Link href="/hr/payroll" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Payroll
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-heading font-semibold tracking-tight">Perhitungan Gaji {categoryLabel}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Daftar periode gaji yang sudah dibuat untuk kategori {categoryLabel.toLowerCase()}.</p>
          </div>
          <Button onClick={openForm} className="shrink-0">
            <Plus className="h-4 w-4" /> Periode Baru
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Buat Periode Gaji</CardTitle>
          </CardHeader>
          <CardContent>
            {category === "outlet" ? (
              <form onSubmit={handleSubmit} className="grid gap-4">
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Rentang tanggal &amp; label ikut jadwal tetap yang sudah diumumkan (siklus 21 s.d. 20, gajian tanggal
                  25) - tidak bisa diubah, supaya tidak ada ruang salah input. Sistem otomatis hitung gaji semua karyawan
                  aktif Outlet dari data absensi yang sudah diupload utk rentang ini.
                </p>
                {nextOutletRange ? (
                  <div className="grid gap-4 sm:grid-cols-3 rounded-lg border bg-muted/30 px-4 py-3">
                    <div className="grid gap-0.5">
                      <span className="text-xs text-muted-foreground">Label Periode</span>
                      <span className="text-sm font-medium">{outletPeriodLabel(nextOutletRange.end)}</span>
                    </div>
                    <div className="grid gap-0.5">
                      <span className="text-xs text-muted-foreground">Mulai</span>
                      <span className="text-sm font-medium">{formatDate(toDateInputValue(nextOutletRange.start))}</span>
                    </div>
                    <div className="grid gap-0.5">
                      <span className="text-xs text-muted-foreground">Sampai</span>
                      <span className="text-sm font-medium">{formatDate(toDateInputValue(nextOutletRange.end))}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-destructive">Tidak ada periode outlet sebelumnya - hubungi developer.</p>
                )}
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving || !nextOutletRange}>
                    {saving ? "Membuat..." : "Buat & Hitung Periode Berikutnya"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Batal</Button>
                </div>
              </form>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  Default rentang tanggal 21 s.d. 20 bulan berikutnya (siklus gajian tanggal 25) - boleh diubah bebas
                  kalau perlu penyesuaian sementara. Sistem otomatis membuat baris gaji untuk semua karyawan aktif
                  kategori kantor, dengan saran awal dari gaji pokok &amp; data absensi pada rentang tanggal ini - tetap
                  bisa diedit satu-satu di halaman berikutnya.
                </p>
                <form onSubmit={handleSubmit} className="grid gap-4">
                  <div className="grid gap-1.5">
                    <Label>Label Periode</Label>
                    <Input value={label} onChange={(e) => setLabel(e.target.value)} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label>Mulai</Label>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Sampai</Label>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving}>{saving ? "Membuat..." : "Buat & Hitung"}</Button>
                    <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Batal</Button>
                  </div>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-2">
        {!loading && periods.length === 0 && (
          <p className="text-sm text-muted-foreground">Belum ada periode gaji {categoryLabel.toLowerCase()}.</p>
        )}
        {periods.map((p) => (
          <Link
            key={p.id}
            href={`/hr/payroll/${category}/${p.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 hover:bg-muted/50"
          >
            <div>
              <p className="font-medium text-sm">{p.label}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(p.startDate)} - {formatDate(p.endDate)} &middot; {p._count.items} karyawan
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={p.status === "final" ? "default" : "outline"} className="font-normal">
                {p.status === "final" ? "Final" : "Draft"}
              </Badge>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
