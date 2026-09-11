"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Upload, FileText, Trash2, CheckCircle2, Circle, MessageCircle } from "lucide-react";
import { upload } from "@vercel/blob/client";
import { REQUIRED_ONBOARDING_FIELDS, getMissingOnboardingFields } from "@/lib/employee-onboarding";
import { toWaNumber } from "@/lib/whatsapp";

const STATUS_LABEL: Record<string, string> = { onboarding: "Onboarding", active: "Aktif", resigned: "Resign" };
const EMPLOYMENT_STATUS_OPTIONS = [
  { value: "tetap", label: "Karyawan Tetap" },
  { value: "kontrak", label: "Kontrak" },
  { value: "pkwt", label: "PKWT" },
  { value: "magang", label: "Magang" },
];
const DOCUMENT_TYPES = [
  { value: "ktp", label: "KTP" },
  { value: "ijazah", label: "Ijazah" },
  { value: "kontrak_kerja", label: "Kontrak Kerja" },
  { value: "lainnya", label: "Lainnya" },
];
const documentTypeLabel = (v: string) => DOCUMENT_TYPES.find((d) => d.value === v)?.label ?? v;

const HISTORY_FIELD_LABEL: Record<string, string> = {
  position: "Jabatan",
  outlet: "Outlet/Cabang",
  employmentStatus: "Status Kepegawaian",
  baseSalary: "Gaji Pokok",
  allowance: "Tunjangan Tetap",
  dailyTransportRate: "Uang Transport/Hari",
  dailyMealRate: "Uang Makan/Hari",
  standardWorkDays: "Hari Kerja Standar",
  dailyBaseRate: "Gaji Harian (Part Time)",
};

const RUPIAH_HISTORY_FIELDS = new Set(["baseSalary", "allowance", "dailyTransportRate", "dailyMealRate", "dailyBaseRate"]);

function formatHistoryValue(field: string, value: string | null) {
  if (value == null) return "-";
  if (RUPIAH_HISTORY_FIELDS.has(field)) return `Rp${Number(value).toLocaleString("id-ID")}`;
  if (field === "employmentStatus") return EMPLOYMENT_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
  return value;
}

type Document = { id: number; type: string; fileUrl: string; fileName: string | null };
type HistoryEntry = {
  id: number;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  effectiveDate: string;
  note: string | null;
  createdBy: { name: string } | null;
};
type Employee = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  birthPlace: string | null;
  birthDate: string | null;
  gender: string | null;
  address: string | null;
  employeeCode: string | null;
  ktpNumber: string | null;
  position: string | null;
  outlet: string | null;
  employmentStatus: string | null;
  joinDate: string | null;
  resignDate: string | null;
  status: string;
  baseSalary: number | null;
  allowance: number | null;
  dailyTransportRate: number | null;
  dailyMealRate: number | null;
  standardWorkDays: number | null;
  dailyBaseRate: number | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  npwp: string | null;
  bpjsKesehatanNumber: string | null;
  bpjsKetenagakerjaanNumber: string | null;
  documents: Document[];
  candidate: { jobPosting: { title: string } } | null;
  historyEntries: HistoryEntry[];
};

function toDateInput(iso: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

function todayInput() {
  return toDateInput(new Date().toISOString());
}

const emptyForm = {
  name: "", email: "", phone: "", birthPlace: "", birthDate: "", gender: "", address: "",
  employeeCode: "", ktpNumber: "", position: "", outlet: "", employmentStatus: "", joinDate: "", resignDate: "",
  baseSalary: "", allowance: "", dailyTransportRate: "", dailyMealRate: "", standardWorkDays: "", dailyBaseRate: "",
  bankName: "", bankAccountNumber: "", bankAccountHolder: "",
  npwp: "", bpjsKesehatanNumber: "", bpjsKetenagakerjaanNumber: "",
};

export default function KaryawanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [historyEffectiveDate, setHistoryEffectiveDate] = useState(todayInput());
  const [historyNote, setHistoryNote] = useState("");
  const [changingStatus, setChangingStatus] = useState(false);
  const [docType, setDocType] = useState("ktp");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function load() {
    setLoading(true);
    fetch(`/api/employees/${id}`)
      .then((r) => r.json())
      .then((e: Employee) => {
        setEmployee(e);
        setForm({
          name: e.name ?? "", email: e.email ?? "", phone: e.phone ?? "",
          birthPlace: e.birthPlace ?? "", birthDate: toDateInput(e.birthDate), gender: e.gender ?? "", address: e.address ?? "",
          employeeCode: e.employeeCode ?? "", ktpNumber: e.ktpNumber ?? "", position: e.position ?? "", outlet: e.outlet ?? "",
          employmentStatus: e.employmentStatus ?? "", joinDate: toDateInput(e.joinDate), resignDate: toDateInput(e.resignDate),
          baseSalary: e.baseSalary != null ? String(e.baseSalary) : "", allowance: e.allowance != null ? String(e.allowance) : "",
          dailyTransportRate: e.dailyTransportRate != null ? String(e.dailyTransportRate) : "",
          dailyMealRate: e.dailyMealRate != null ? String(e.dailyMealRate) : "",
          standardWorkDays: e.standardWorkDays != null ? String(e.standardWorkDays) : "",
          dailyBaseRate: e.dailyBaseRate != null ? String(e.dailyBaseRate) : "",
          bankName: e.bankName ?? "", bankAccountNumber: e.bankAccountNumber ?? "", bankAccountHolder: e.bankAccountHolder ?? "",
          npwp: e.npwp ?? "", bpjsKesehatanNumber: e.bpjsKesehatanNumber ?? "", bpjsKetenagakerjaanNumber: e.bpjsKetenagakerjaanNumber ?? "",
        });
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  function set<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Nama wajib diisi");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, historyEffectiveDate, historyNote }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Data karyawan disimpan.");
      setHistoryNote("");
      setHistoryEffectiveDate(todayInput());
      load();
    } else {
      const err = await res.json();
      toast.error("Gagal: " + err.error);
    }
  }

  async function handleStatusChange(status: string) {
    setChangingStatus(true);
    const res = await fetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setChangingStatus(false);
    if (res.ok) {
      toast.success(`Status diubah ke "${STATUS_LABEL[status]}".`);
      load();
    } else {
      const err = await res.json();
      toast.error("Gagal: " + err.error);
    }
  }

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !employee) return;
    setUploadingDoc(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/employees/upload-document",
      });
      const res = await fetch(`/api/employees/${employee.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: docType, fileUrl: blob.url, fileName: file.name }),
      });
      if (res.ok) {
        toast.success("Dokumen diupload.");
        load();
      } else {
        const err = await res.json();
        toast.error("Gagal simpan dokumen: " + err.error);
      }
    } catch (err) {
      toast.error("Gagal upload dokumen: " + (err instanceof Error ? err.message : "unknown"));
    } finally {
      setUploadingDoc(false);
      e.target.value = "";
    }
  }

  async function handleDeleteDoc(documentId: number) {
    const res = await fetch(`/api/employees/${id}/documents`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    if (res.ok) {
      toast.success("Dokumen dihapus.");
      load();
    } else {
      toast.error("Gagal hapus dokumen.");
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Memuat...</p>;
  if (!employee) return <p className="text-sm text-muted-foreground">Karyawan tidak ditemukan.</p>;

  const hasKtp = employee.documents.some((d) => d.type === "ktp");
  const missing = getMissingOnboardingFields(
    {
      ktpNumber: form.ktpNumber || null,
      position: form.position || null,
      outlet: form.outlet || null,
      employmentStatus: form.employmentStatus || null,
      joinDate: form.joinDate || null,
      baseSalary: form.baseSalary || null,
      bankName: form.bankName || null,
      bankAccountNumber: form.bankAccountNumber || null,
    },
    hasKtp
  );

  return (
    <div className="max-w-3xl grid gap-6">
      <div>
        <Link href="/hr/karyawan" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Database Karyawan
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-heading font-semibold tracking-tight">{employee.name}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {employee.candidate?.jobPosting.title ? `Dari lamaran: ${employee.candidate.jobPosting.title}` : "Ditambahkan manual"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={employee.status === "active" ? "default" : employee.status === "resigned" ? "secondary" : "outline"}>
              {STATUS_LABEL[employee.status] ?? employee.status}
            </Badge>
            <Select value={employee.status} onValueChange={(v) => v && handleStatusChange(v)}>
              <SelectTrigger className="w-40" disabled={changingStatus}>
                <SelectValue>{() => "Ubah Status"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="onboarding">Onboarding</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="resigned">Resign</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {employee.status === "onboarding" && (
        <Card className={missing.length > 0 ? "border-destructive/40" : "border-primary/30"}>
          <CardHeader>
            <CardTitle className="text-base">Checklist Onboarding</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1.5">
            {REQUIRED_ONBOARDING_FIELDS.map((f) => {
              const done = !missing.includes(f.label);
              return (
                <div key={f.key} className="flex items-center gap-2 text-sm">
                  {done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                  <span className={done ? "" : "text-muted-foreground"}>{f.label}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-2 text-sm">
              {hasKtp ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              <span className={hasKtp ? "" : "text-muted-foreground"}>Upload KTP</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Lengkapi &amp; simpan semua data di bawah, lalu ubah status ke &quot;Aktif&quot; lewat dropdown di atas.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Biodata</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Nama Lengkap</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>No. HP / WhatsApp</Label>
              {employee.phone && (
                <button
                  type="button"
                  onClick={() => window.open(`https://wa.me/${toWaNumber(employee.phone!)}`, "_blank")}
                  title="Chat WhatsApp"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Chat WA
                </button>
              )}
            </div>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Jenis Kelamin</Label>
            <Select value={form.gender} onValueChange={(v) => v && set("gender", v)}>
              <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="L">Laki-laki</SelectItem>
                <SelectItem value="P">Perempuan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Tempat Lahir</Label>
            <Input value={form.birthPlace} onChange={(e) => set("birthPlace", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Tanggal Lahir</Label>
            <Input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Alamat</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Data Kepegawaian</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>No. KTP</Label>
            <Input value={form.ktpNumber} onChange={(e) => set("ktpNumber", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>ID Karyawan (opsional)</Label>
            <Input value={form.employeeCode} onChange={(e) => set("employeeCode", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Jabatan</Label>
            <Input value={form.position} onChange={(e) => set("position", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Outlet / Cabang</Label>
            <Input value={form.outlet} onChange={(e) => set("outlet", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Status Kepegawaian</Label>
            <Select value={form.employmentStatus} onValueChange={(v) => v && set("employmentStatus", v)}>
              <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
              <SelectContent>
                {EMPLOYMENT_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Tanggal Mulai Kerja</Label>
            <Input type="date" value={form.joinDate} onChange={(e) => set("joinDate", e.target.value)} />
          </div>
          {employee.status === "resigned" && (
            <div className="grid gap-1.5">
              <Label>Tanggal Resign</Label>
              <Input type="date" value={form.resignDate} onChange={(e) => set("resignDate", e.target.value)} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Gaji &amp; Bank</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Gaji Pokok (Rp/bulan)</Label>
            <Input type="number" value={form.baseSalary} onChange={(e) => set("baseSalary", e.target.value)} />
            <p className="text-xs text-muted-foreground">Untuk karyawan tetap/bulanan. Kosongkan kalau karyawan part time.</p>
          </div>
          <div className="grid gap-1.5">
            <Label>Gaji Harian - Part Time (Rp/hari)</Label>
            <Input type="number" value={form.dailyBaseRate} onChange={(e) => set("dailyBaseRate", e.target.value)} />
            <p className="text-xs text-muted-foreground">Untuk karyawan part time (mis. Rp150.000/hari). Kosongkan kalau bulanan.</p>
          </div>
          <div className="grid gap-1.5">
            <Label>Tunjangan Tetap (Rp/bulan)</Label>
            <Input type="number" value={form.allowance} onChange={(e) => set("allowance", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Uang Transport (Rp/hari hadir)</Label>
            <Input type="number" value={form.dailyTransportRate} onChange={(e) => set("dailyTransportRate", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Uang Makan (Rp/hari hadir)</Label>
            <Input type="number" value={form.dailyMealRate} onChange={(e) => set("dailyMealRate", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Hari Kerja Standar/Bulan</Label>
            <Input
              type="number"
              value={form.standardWorkDays}
              onChange={(e) => set("standardWorkDays", e.target.value)}
              placeholder="mis. 25 atau 27"
            />
            <p className="text-xs text-muted-foreground">
              Dipakai Payroll Outlet untuk hitung rate lembur (Uang Makan/hari &divide; 3) &amp; potongan telat.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label>Nama Bank</Label>
            <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} placeholder="mis. BCA" />
          </div>
          <div className="grid gap-1.5">
            <Label>No. Rekening</Label>
            <Input value={form.bankAccountNumber} onChange={(e) => set("bankAccountNumber", e.target.value)} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Nama Pemilik Rekening (kalau beda dari nama karyawan)</Label>
            <Input value={form.bankAccountHolder} onChange={(e) => set("bankAccountHolder", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Legal &amp; Pajak</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>NPWP</Label>
            <Input value={form.npwp} onChange={(e) => set("npwp", e.target.value)} />
          </div>
          <div className="hidden sm:block" />
          <div className="grid gap-1.5">
            <Label>No. BPJS Kesehatan</Label>
            <Input value={form.bpjsKesehatanNumber} onChange={(e) => set("bpjsKesehatanNumber", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>No. BPJS Ketenagakerjaan</Label>
            <Input value={form.bpjsKetenagakerjaanNumber} onChange={(e) => set("bpjsKetenagakerjaanNumber", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat Jabatan &amp; Gaji</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-xs text-muted-foreground -mt-1">
            Kalau Anda mengubah Jabatan, Outlet/Cabang, Status Kepegawaian, Gaji Pokok, atau Tunjangan Tetap di atas,
            perubahannya otomatis tersimpan sebagai riwayat begitu Anda klik &quot;Simpan Perubahan&quot; - isi dulu tanggal
            efektif &amp; keterangannya di sini.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Tanggal Efektif Perubahan</Label>
              <Input type="date" value={historyEffectiveDate} onChange={(e) => setHistoryEffectiveDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Keterangan (opsional)</Label>
              <Input
                value={historyNote}
                onChange={(e) => setHistoryNote(e.target.value)}
                placeholder="mis. promosi ke Supervisor"
              />
            </div>
          </div>

          {employee.historyEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada riwayat perubahan.</p>
          ) : (
            <div className="grid gap-2">
              {employee.historyEntries.map((h) => (
                <div key={h.id} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <p>
                      <span className="font-medium">{HISTORY_FIELD_LABEL[h.field] ?? h.field}</span>
                      {": "}
                      {formatHistoryValue(h.field, h.oldValue)} &rarr; {formatHistoryValue(h.field, h.newValue)}
                    </p>
                    <p className="text-xs text-muted-foreground shrink-0">
                      Efektif {new Date(h.effectiveDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  {h.note && <p className="text-xs text-muted-foreground mt-0.5">{h.note}</p>}
                  {h.createdBy && <p className="text-xs text-muted-foreground mt-0.5">Dicatat oleh {h.createdBy.name}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Perubahan"}</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Dokumen Kepegawaian</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1.5">
              <Label>Jenis Dokumen</Label>
              <Select value={docType} onValueChange={(v) => v && setDocType(v)}>
                <SelectTrigger className="w-44"><SelectValue>{() => documentTypeLabel(docType)}</SelectValue></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" disabled={uploadingDoc} onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> {uploadingDoc ? "Mengupload..." : "Upload File"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={handleDocUpload}
              disabled={uploadingDoc}
            />
          </div>

          {employee.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada dokumen diupload.</p>
          ) : (
            <div className="grid gap-2">
              {employee.documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <a
                    href={d.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline min-w-0"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{documentTypeLabel(d.type)} - {d.fileName ?? "file"}</span>
                  </a>
                  <button type="button" onClick={() => handleDeleteDoc(d.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
