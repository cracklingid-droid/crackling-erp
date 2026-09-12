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
import { ArrowLeft, Upload, FileText, Trash2, CheckCircle2, Circle, MessageCircle, Wand2, Copy, KeyRound } from "lucide-react";
import { upload } from "@vercel/blob/client";
import { REQUIRED_ONBOARDING_FIELDS, getMissingOnboardingFields } from "@/lib/employee-onboarding";
import { computeCompleteness } from "@/lib/employee-completeness";
import { derivePortalPassword, canUsePortal } from "@/lib/employee-portal";
import { prefixForOutlet } from "@/lib/employee-code";
import { toWaNumber } from "@/lib/whatsapp";
import { EmployeeAvatar } from "@/app/components/EmployeeAvatar";

const STATUS_LABEL: Record<string, string> = { onboarding: "Onboarding", active: "Aktif", resigned: "Resign" };
const EMPLOYMENT_STATUS_OPTIONS = [
  { value: "tetap", label: "Karyawan Tetap" },
  { value: "kontrak", label: "Kontrak" },
  { value: "pkwt", label: "PKWT" },
  { value: "magang", label: "Magang" },
];
const WEEKDAY_OPTIONS = [
  { value: 1, label: "Sen" },
  { value: 2, label: "Sel" },
  { value: 3, label: "Rab" },
  { value: 4, label: "Kam" },
  { value: 5, label: "Jum" },
  { value: 6, label: "Sab" },
  { value: 0, label: "Min" },
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

type Document = { id: number; type: string; fileUrl: string; fileName: string | null; expiryDate: string | null };
type EmployeeRef = { id: number; name: string; position: string | null; outlet: string | null };
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
  workSchedule: string | null;
  defaultOffDays: number[];
  joinDate: string | null;
  resignDate: string | null;
  status: string;
  baseSalary: number | null;
  allowance: number | null;
  dailyTransportRate: number | null;
  dailyMealRate: number | null;
  standardWorkDays: number | null;
  dailyBaseRate: number | null;
  depositInstallmentsPaid: number;
  depositBalance: number;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  npwp: string | null;
  bpjsKesehatanNumber: string | null;
  bpjsKetenagakerjaanNumber: string | null;
  photoUrl: string | null;
  contractEndDate: string | null;
  reportsToId: number | null;
  reportsTo: { id: number; name: string } | null;
  directReports: EmployeeRef[];
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
  employeeCode: "", ktpNumber: "", position: "", outlet: "", employmentStatus: "", workSchedule: "", joinDate: "", resignDate: "",
  baseSalary: "", allowance: "", dailyTransportRate: "", dailyMealRate: "", standardWorkDays: "", dailyBaseRate: "",
  depositInstallmentsPaid: "", depositBalance: "",
  bankName: "", bankAccountNumber: "", bankAccountHolder: "",
  npwp: "", bpjsKesehatanNumber: "", bpjsKetenagakerjaanNumber: "",
  contractEndDate: "", reportsToId: "",
};

export default function KaryawanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [offDays, setOffDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [historyEffectiveDate, setHistoryEffectiveDate] = useState(todayInput());
  const [historyNote, setHistoryNote] = useState("");
  const [changingStatus, setChangingStatus] = useState(false);
  const [docType, setDocType] = useState("ktp");
  const [docExpiryDate, setDocExpiryDate] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [otherEmployees, setOtherEmployees] = useState<EmployeeRef[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  function load() {
    setLoading(true);
    fetch(`/api/employees/${id}`)
      .then((r) => r.json())
      .then((e: Employee) => {
        setEmployee(e);
        setOffDays(e.defaultOffDays ?? []);
        setForm({
          name: e.name ?? "", email: e.email ?? "", phone: e.phone ?? "",
          birthPlace: e.birthPlace ?? "", birthDate: toDateInput(e.birthDate), gender: e.gender ?? "", address: e.address ?? "",
          employeeCode: e.employeeCode ?? "", ktpNumber: e.ktpNumber ?? "", position: e.position ?? "", outlet: e.outlet ?? "",
          employmentStatus: e.employmentStatus ?? "", workSchedule: e.workSchedule ?? "",
          joinDate: toDateInput(e.joinDate), resignDate: toDateInput(e.resignDate),
          baseSalary: e.baseSalary != null ? String(e.baseSalary) : "", allowance: e.allowance != null ? String(e.allowance) : "",
          dailyTransportRate: e.dailyTransportRate != null ? String(e.dailyTransportRate) : "",
          dailyMealRate: e.dailyMealRate != null ? String(e.dailyMealRate) : "",
          standardWorkDays: e.standardWorkDays != null ? String(e.standardWorkDays) : "",
          dailyBaseRate: e.dailyBaseRate != null ? String(e.dailyBaseRate) : "",
          depositInstallmentsPaid: String(e.depositInstallmentsPaid ?? 0), depositBalance: String(e.depositBalance ?? 0),
          bankName: e.bankName ?? "", bankAccountNumber: e.bankAccountNumber ?? "", bankAccountHolder: e.bankAccountHolder ?? "",
          npwp: e.npwp ?? "", bpjsKesehatanNumber: e.bpjsKesehatanNumber ?? "", bpjsKetenagakerjaanNumber: e.bpjsKetenagakerjaanNumber ?? "",
          contractEndDate: toDateInput(e.contractEndDate), reportsToId: e.reportsToId != null ? String(e.reportsToId) : "",
        });
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);
  useEffect(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((list: (EmployeeRef & { id: number; status: string })[]) =>
        setOtherEmployees(list.filter((e) => e.id !== Number(id) && e.status !== "resigned"))
      );
  }, [id]);

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
      body: JSON.stringify({ ...form, defaultOffDays: offDays, historyEffectiveDate, historyNote }),
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
        body: JSON.stringify({ type: docType, fileUrl: blob.url, fileName: file.name, expiryDate: docExpiryDate || null }),
      });
      if (res.ok) {
        toast.success("Dokumen diupload.");
        setDocExpiryDate("");
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

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !employee) return;
    setUploadingPhoto(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/employees/upload-document",
      });
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: blob.url }),
      });
      if (res.ok) {
        toast.success("Foto profil diperbarui.");
        load();
      } else {
        const err = await res.json();
        toast.error("Gagal simpan foto: " + err.error);
      }
    } catch (err) {
      toast.error("Gagal upload foto: " + (err instanceof Error ? err.message : "unknown"));
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  }

  async function handleGenerateCode() {
    if (!form.outlet) {
      toast.error("Pilih/isi Outlet dulu");
      return;
    }
    setGeneratingCode(true);
    const res = await fetch(`/api/employees/next-code?outlet=${encodeURIComponent(form.outlet)}`);
    const data = await res.json();
    setGeneratingCode(false);
    if (res.ok) {
      set("employeeCode", data.code);
      toast.success(`Kode diisi: ${data.code} (belum tersimpan, klik "Simpan Perubahan")`);
    } else {
      toast.error(data.error);
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
  const completeness = computeCompleteness(employee, hasKtp);

  return (
    <div className="max-w-3xl grid gap-6">
      <div>
        <Link href="/hr/karyawan" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Database Karyawan
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              title="Ganti foto profil"
              className="relative shrink-0 rounded-full ring-1 ring-border hover:opacity-80 transition-opacity"
            >
              <EmployeeAvatar photoUrl={employee.photoUrl} name={employee.name} size={56} />
            </button>
            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
            <div>
              <h1 className="text-2xl font-heading font-semibold tracking-tight">{employee.name}</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {employee.candidate?.jobPosting.title ? `Dari lamaran: ${employee.candidate.jobPosting.title}` : "Ditambahkan manual"}
              </p>
            </div>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Kelengkapan Data
            <span className={completeness.percent === 100 ? "text-emerald-600" : completeness.percent >= 60 ? "text-amber-600" : "text-destructive"}>
              {completeness.percent}%
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {completeness.missing.length === 0 ? (
            <p className="text-sm text-muted-foreground">Semua data standar sudah lengkap.</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Belum lengkap: {completeness.missing.join(", ")}.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" /> Akun Portal Karyawan
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!canUsePortal(employee) ? (
            <p className="text-sm text-muted-foreground">
              Belum bisa dipakai - lengkapi dulu {!employee.employeeCode && "ID Karyawan"}
              {!employee.employeeCode && !employee.birthDate && " dan "}
              {!employee.birthDate && "Tanggal Lahir"} di atas.
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <p className="text-xs text-muted-foreground">ID Karyawan</p>
                <p className="text-sm font-mono font-medium">{employee.employeeCode}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Password</p>
                <p className="text-sm font-mono font-medium">{derivePortalPassword(employee.employeeCode!, employee.birthDate!)}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `ID: ${employee.employeeCode}\nPassword: ${derivePortalPassword(employee.employeeCode!, employee.birthDate!)}\nLogin di: /portal/login`
                  );
                  toast.success("ID & password disalin.");
                }}
              >
                <Copy className="h-3.5 w-3.5" /> Salin
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Password tetap = ID Karyawan + tahun lahir, tidak berubah kecuali ID Karyawan atau Tanggal Lahir diedit. Karyawan
            login di halaman Portal Karyawan utk lihat profil, roster & riwayat slip gaji sendiri.
          </p>
        </CardContent>
      </Card>

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
            <div className="flex gap-2">
              <Input value={form.employeeCode} onChange={(e) => set("employeeCode", e.target.value)} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Generate ID Otomatis dari Outlet"
                disabled={generatingCode || !prefixForOutlet(form.outlet)}
                onClick={handleGenerateCode}
              >
                <Wand2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {!prefixForOutlet(form.outlet) && (
              <p className="text-xs text-muted-foreground">
                Kode otomatis tersedia utk Outlet: Gading Serpong (GS), Kelapa Gading (KG), Joglo/Central Kitchen (JO), Fatgai (FG).
              </p>
            )}
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
            <Label>Jadwal Kerja</Label>
            <Input value={form.workSchedule} onChange={(e) => set("workSchedule", e.target.value)} placeholder="mis. 08:00-20:00" />
            <p className="text-xs text-muted-foreground">Ditampilkan di halaman Rincian Perhitungan gaji sbg pembanding jam masuk/pulang aktual.</p>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Hari Libur Rutin (Default)</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_OPTIONS.map((d) => {
                const active = offDays.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setOffDays((prev) => (active ? prev.filter((v) => v !== d.value) : [...prev, d.value]))}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      active ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Roster outlet karyawan ini otomatis terisi Masuk/Libur tiap buka minggu baru sesuai pola ini. Kosongkan kalau
              jadwalnya tidak tetap.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label>Tanggal Mulai Kerja</Label>
            <Input type="date" value={form.joinDate} onChange={(e) => set("joinDate", e.target.value)} />
          </div>
          {(form.employmentStatus === "kontrak" || form.employmentStatus === "pkwt") && (
            <div className="grid gap-1.5">
              <Label>Tanggal Akhir Kontrak</Label>
              <Input type="date" value={form.contractEndDate} onChange={(e) => set("contractEndDate", e.target.value)} />
              <p className="text-xs text-muted-foreground">Muncul di daftar "Segera Jatuh Tempo" di Database Karyawan, H-30 sebelum tanggal ini.</p>
            </div>
          )}
          {employee.status === "resigned" && (
            <div className="grid gap-1.5">
              <Label>Tanggal Resign</Label>
              <Input type="date" value={form.resignDate} onChange={(e) => set("resignDate", e.target.value)} />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>Atasan Langsung</Label>
            <Select value={form.reportsToId || "none"} onValueChange={(v) => set("reportsToId", v === "none" ? "" : v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Tidak ada">
                  {() => otherEmployees.find((o) => String(o.id) === form.reportsToId)?.name ?? "Tidak ada"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tidak ada</SelectItem>
                {otherEmployees.map((o) => (
                  <SelectItem key={o.id} value={String(o.id)}>
                    {o.name}{o.outlet ? ` (${o.outlet})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {employee.directReports.length > 0 && (
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>Bawahan Langsung</Label>
              <div className="flex flex-wrap gap-1.5">
                {employee.directReports.map((r) => (
                  <Link key={r.id} href={`/hr/karyawan/${r.id}`}>
                    <Badge variant="outline" className="font-normal hover:bg-muted">{r.name}</Badge>
                  </Link>
                ))}
              </div>
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
          {form.employmentStatus === "kontrak" && (
            <>
              <div className="grid gap-1.5">
                <Label>Cicilan Deposit Terpotong</Label>
                <Input
                  type="number"
                  min={0}
                  max={2}
                  value={form.depositInstallmentsPaid}
                  onChange={(e) => set("depositInstallmentsPaid", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Dari 2x potongan otomatis Rp250.000 di tanggal 10. Ubah manual kalau perlu koreksi (mis. migrasi data lama).
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label>Saldo Deposit Ditahan (Rp)</Label>
                <Input type="number" value={form.depositBalance} onChange={(e) => set("depositBalance", e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  Otomatis mengikuti "Bayar Deposit"/"Kembali Deposit" di Payroll Outlet. Jadi acuan HR saat karyawan resign.
                </p>
              </div>
            </>
          )}
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
            <div className="grid gap-1.5">
              <Label>Kedaluwarsa (opsional)</Label>
              <Input type="date" className="w-40" value={docExpiryDate} onChange={(e) => setDocExpiryDate(e.target.value)} />
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
              {employee.documents.map((d) => {
                const expiringSoon = d.expiryDate && new Date(d.expiryDate).getTime() - Date.now() < 30 * 86400000;
                return (
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
                  <div className="flex items-center gap-2 shrink-0">
                    {d.expiryDate && (
                      <span className={`text-xs ${expiringSoon ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        Kedaluwarsa {new Date(d.expiryDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                    <button type="button" onClick={() => handleDeleteDoc(d.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
