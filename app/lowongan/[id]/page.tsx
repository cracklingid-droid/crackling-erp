"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Upload, FileCheck, X } from "lucide-react";

type Posting = {
  id: number;
  title: string;
  department: string | null;
  location: string | null;
  employmentType: string | null;
  description: string | null;
  requiresKitchenTerms: boolean;
  isOfficePosition: boolean;
};

const EDUCATION_OPTIONS = ["SD", "SMP", "SMA/SMK", "D3", "S1", "S2"];
const OUTLET_OPTIONS = ["Joglo (Central Kitchen)", "Gading Serpong", "Kelapa Gading"];
const MIN_AGE = 18;

function maxBirthDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - MIN_AGE);
  return d.toISOString().slice(0, 10);
}

export default function LowonganDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [posting, setPosting] = useState<Posting | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "", email: "", phone: "", birthPlace: "", birthDate: "", gender: "",
    address: "", preferredOutlet: "", lastEducation: "", institution: "",
    experience: "", expectedSalary: "",
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const [agreedB2, setAgreedB2] = useState(false);
  const [agreedLongShift, setAgreedLongShift] = useState(false);
  const [agreedNoPinjol, setAgreedNoPinjol] = useState(false);
  const [agreedStartSoon, setAgreedStartSoon] = useState(false);

  const [cvUrl, setCvUrl] = useState("");
  const [cvFileName, setCvFileName] = useState("");
  const [uploadingCv, setUploadingCv] = useState(false);

  async function handleCvChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCv(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/public/upload-cv", { method: "POST", body: fd });
    setUploadingCv(false);
    if (res.ok) {
      const data = await res.json();
      setCvUrl(data.url);
      setCvFileName(data.name);
      toast.success("CV berhasil diupload.");
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Gagal upload CV");
    }
    e.target.value = "";
  }

  useEffect(() => {
    fetch(`/api/public/job-postings/${id}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then((p) => p && setPosting(p))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.birthDate > maxBirthDate()) {
      toast.error(`Pelamar harus berusia minimal ${MIN_AGE} tahun`);
      return;
    }
    if (posting?.requiresKitchenTerms && (!agreedB2 || !agreedLongShift || !agreedNoPinjol)) {
      toast.error("Semua Syarat & Ketentuan wajib dicentang");
      return;
    }
    if (!agreedStartSoon) {
      toast.error("Kesediaan mengisi psikotest dalam 30 menit wajib dicentang");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/public/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobPostingId: Number(id), ...form, cvUrl, agreedB2, agreedLongShift, agreedNoPinjol, agreedStartSoon }),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      toast.success("Lamaran diterima. Lanjut ke psikotest.");
      router.push(`/psikotes/${data.token}`);
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Gagal mengirim lamaran");
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Memuat...</div>;
  if (notFound || !posting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-sm text-muted-foreground">Lowongan tidak ditemukan atau sudah ditutup.</p>
        <Link href="/lowongan" className="text-primary text-sm underline">Lihat lowongan lain</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10 md:py-16">
        <Link href="/lowongan" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3.5 w-3.5" /> Semua Lowongan
        </Link>

        <h1 className="text-2xl font-heading font-semibold tracking-tight">{posting.title}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {[posting.department, posting.location, posting.employmentType].filter(Boolean).join(" · ") || "-"}
        </p>
        {posting.description && <p className="text-sm mt-3 whitespace-pre-line">{posting.description}</p>}

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">Form Lamaran</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Nama Lengkap</Label>
                <Input required value={form.name} onChange={(e) => set("name")(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Email</Label>
                  <Input required type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>No. HP / WhatsApp</Label>
                  <Input required value={form.phone} onChange={(e) => set("phone")(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Tempat Lahir</Label>
                  <Input required value={form.birthPlace} onChange={(e) => set("birthPlace")(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Tanggal Lahir</Label>
                  <Input required type="date" max={maxBirthDate()} value={form.birthDate} onChange={(e) => set("birthDate")(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Pelamar minimal berusia {MIN_AGE} tahun.</p>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Jenis Kelamin</Label>
                <Select value={form.gender} onValueChange={(v) => v && set("gender")(v)}>
                  <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Laki-laki</SelectItem>
                    <SelectItem value="P">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Alamat Lengkap</Label>
                <Textarea required rows={2} value={form.address} onChange={(e) => set("address")(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Lokasi/Cabang yang Diinginkan</Label>
                {posting.isOfficePosition ? (
                  <Input required value={form.preferredOutlet} onChange={(e) => set("preferredOutlet")(e.target.value)} placeholder="mis. Kantor Pusat" />
                ) : (
                  <Select value={form.preferredOutlet} onValueChange={(v) => v && set("preferredOutlet")(v)}>
                    <SelectTrigger><SelectValue placeholder="Pilih cabang..." /></SelectTrigger>
                    <SelectContent>
                      {OUTLET_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Pendidikan Terakhir</Label>
                  <Select value={form.lastEducation} onValueChange={(v) => v && set("lastEducation")(v)}>
                    <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                    <SelectContent>
                      {EDUCATION_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Sekolah/Kampus &amp; Jurusan</Label>
                  <Input required value={form.institution} onChange={(e) => set("institution")(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Pengalaman Kerja Terakhir (Posisi - Tempat Kerja)</Label>
                <Input
                  required
                  value={form.experience}
                  onChange={(e) => set("experience")(e.target.value)}
                  placeholder="mis. Cook - Hotel ABC"
                />
                <p className="text-xs text-muted-foreground">Belum pernah bekerja? Tulis &quot;Belum ada pengalaman&quot;.</p>
              </div>
              <div className="grid gap-1.5 max-w-60">
                <Label>Ekspektasi Gaji (Rp)</Label>
                <Input required type="number" min={0} value={form.expectedSalary} onChange={(e) => set("expectedSalary")(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Upload CV</Label>
                {cvFileName ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 truncate">
                      <FileCheck className="h-4 w-4 text-primary shrink-0" /> {cvFileName}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setCvUrl(""); setCvFileName(""); }}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-sm cursor-pointer hover:bg-muted/50 text-muted-foreground">
                    <Upload className="h-4 w-4" />
                    {uploadingCv ? "Mengupload..." : "Pilih file CV (PDF/DOC/DOCX, maks 5MB)"}
                    <input type="file" accept=".pdf,.doc,.docx" className="hidden" disabled={uploadingCv} onChange={handleCvChange} />
                  </label>
                )}
              </div>

              {posting.requiresKitchenTerms && (
                <div className="rounded-md border p-4 grid gap-3 bg-muted/30">
                  <p className="text-sm font-medium">Syarat &amp; Ketentuan</p>
                  <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                    <input type="checkbox" className="mt-0.5 accent-primary" checked={agreedB2} onChange={(e) => setAgreedB2(e.target.checked)} />
                    Saya menyatakan tidak keberatan mengolah dan/atau mengonsumsi bahan makanan B2 (daging babi) sesuai kebutuhan operasional dapur.
                  </label>
                  <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                    <input type="checkbox" className="mt-0.5 accent-primary" checked={agreedLongShift} onChange={(e) => setAgreedLongShift(e.target.checked)} />
                    Saya memahami dan bersedia bekerja dengan sistem shift panjang (long shift) selama 12 jam per hari sesuai jadwal yang ditentukan.
                  </label>
                  <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                    <input type="checkbox" className="mt-0.5 accent-primary" checked={agreedNoPinjol} onChange={(e) => setAgreedNoPinjol(e.target.checked)} />
                    Saya menyatakan saat ini tidak sedang memiliki pinjaman pada aplikasi pinjaman online (pinjol).
                  </label>
                </div>
              )}

              <div className="rounded-md border p-4 grid gap-3 bg-muted/30">
                <p className="text-sm font-medium">Kesiapan Psikotest</p>
                <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                  <input type="checkbox" className="mt-0.5 accent-primary" checked={agreedStartSoon} onChange={(e) => setAgreedStartSoon(e.target.checked)} />
                  Saya siap dan bersedia mengisi psikotest dalam 30 menit ke depan setelah lamaran ini dikirim.
                </label>
              </div>

              <Button
                type="submit"
                disabled={
                  submitting ||
                  uploadingCv ||
                  (posting.requiresKitchenTerms && (!agreedB2 || !agreedLongShift || !agreedNoPinjol)) ||
                  !agreedStartSoon
                }
                className="mt-2"
              >
                {submitting ? "Mengirim..." : "Kirim Lamaran & Lanjut Psikotest"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
