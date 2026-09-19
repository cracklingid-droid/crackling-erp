"use client";

import { useEffect, useState } from "react";
import { readJson, errorMessage, readErrorMessage } from "@/lib/fetch-json";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTab, TabsIndicator, TabsPanel } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, ArrowLeft, MessageCircle, AlertTriangle, Search, X } from "lucide-react";
import { toWaNumber } from "@/lib/whatsapp";
import { computeCompleteness } from "@/lib/employee-completeness";
import { employeeCategory } from "@/lib/payroll-config";
import { EMPLOYEE_STATUS_LABEL, EMPLOYEE_STATUS_VARIANT, employmentStatusLabel } from "@/lib/employee-status";
import { EmployeeAvatar } from "@/app/components/EmployeeAvatar";
import { useAuthContext } from "../../../components/AuthContext";

type Employee = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  employeeCode: string | null;
  position: string | null;
  outlet: string | null;
  employmentStatus: string | null;
  status: string;
  photoUrl: string | null;
  ktpNumber: string | null;
  address: string | null;
  birthDate: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  npwp: string | null;
  bpjsKesehatanNumber: string | null;
  bpjsKetenagakerjaanNumber: string | null;
  documents: { type: string }[];
};

type Reminders = {
  contracts: { id: number; name: string; outlet: string | null; position: string | null; contractEndDate: string }[];
  documents: { id: number; type: string; expiryDate: string; employeeId: number; employee: { name: string } }[];
};

const DOC_TYPE_LABEL: Record<string, string> = { ktp: "KTP", ijazah: "Ijazah", kontrak_kerja: "Kontrak Kerja", lainnya: "Dokumen" };

function formatDateId(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function completenessColor(percent: number) {
  if (percent === 100) return "text-emerald-600";
  if (percent >= 60) return "text-amber-600";
  return "text-destructive";
}

const STATUS_LABEL = EMPLOYEE_STATUS_LABEL;
const STATUS_VARIANT = EMPLOYEE_STATUS_VARIANT;

export default function KaryawanPage() {
  const { user } = useAuthContext();
  // "manager" cuma boleh lihat karyawan Resto, view-only (permintaan Kevin
  // 2026-09-13) - API /api/employees sendiri sudah menyaring, ini cuma
  // pertahanan tambahan + sembunyikan tombol tulis di tampilan.
  const readOnly = user?.role === "manager";
  const [tab, setTab] = useState<"outlet" | "kantor">("outlet");
  const [statusFilter, setStatusFilter] = useState<"active" | "resigned" | "all">("active");
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [reminders, setReminders] = useState<Reminders | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/employees")
      .then(readJson)
      .then(setEmployees)
      .catch((e) => toast.error(errorMessage(e, "Gagal memuat data")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);
  useEffect(() => {
    fetch("/api/employees/reminders")
      .then(readJson)
      .then(setReminders)
      .catch(() => {}); // widget pengingat - kalau gagal cukup tidak tampil
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama karyawan wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone }),
      });
      if (res.ok) {
        toast.success("Karyawan ditambahkan. Lengkapi datanya di halaman detail.");
        setName("");
        setEmail("");
        setPhone("");
        setShowForm(false);
        load();
      } else {
        toast.error("Gagal: " + (await readErrorMessage(res)));
      }
    } finally {
      setSaving(false);
    }
  }

  const onboardingCount = employees.filter((e) => e.status === "onboarding").length;
  const activeCount = employees.filter((e) => e.status === "active").length;
  // Dua "database karyawan" terpisah (Resto vs Kantor) - beda total cara
  // hitung gaji & lemburnya (lihat lib/payroll-kantor-calc.ts vs
  // lib/payroll-outlet-calc.ts). Permintaan Kevin 2026-09-13.
  const restoEmployees = employees.filter((e) => employeeCategory(e.outlet) === "outlet");
  const kantorEmployees = employees.filter((e) => employeeCategory(e.outlet) === "kantor");
  const tabEmployeesAll = tab === "outlet" ? restoEmployees : kantorEmployees;
  // Filter Aktif/Resign/Semua di dalam tab Resto/Kantor - defaultnya "Aktif"
  // supaya karyawan yang sudah resign tidak ikut memenuhi halaman begitu
  // jumlahnya banyak (mis. sinkron massal dari sheet HR). Permintaan Kevin
  // 2026-09-18.
  const statusCounts = {
    active: tabEmployeesAll.filter((e) => e.status === "active" || e.status === "onboarding").length,
    resigned: tabEmployeesAll.filter((e) => e.status === "resigned").length,
    all: tabEmployeesAll.length,
  };
  const statusFilteredEmployees =
    statusFilter === "all" ? tabEmployeesAll : tabEmployeesAll.filter((e) => (statusFilter === "active" ? e.status !== "resigned" : e.status === "resigned"));
  // Pencarian nama/jabatan/outlet/kode - tabel makin panjang seiring
  // karyawan bertambah, tanpa filter jadi susah cari 1 orang. Permintaan
  // Kevin 2026-09-17.
  const q = search.trim().toLowerCase();
  const tabEmployees = q
    ? statusFilteredEmployees.filter((e) =>
        [e.name, e.position, e.outlet, e.employeeCode].some((v) => v?.toLowerCase().includes(q))
      )
    : statusFilteredEmployees;

  return (
    <div className="max-w-5xl min-w-0 grid gap-6">
      <div>
        <Link href="/hr" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Human Resource
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-heading font-semibold tracking-tight">Database Karyawan</h1>
            <p className="text-muted-foreground text-sm">
              {employees.length} karyawan · {onboardingCount} perlu dilengkapi datanya · {activeCount} aktif
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/portal/login"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground whitespace-nowrap hidden sm:inline"
            >
              Portal Karyawan &rarr;
            </a>
            {!readOnly && (
              <Button variant={showForm ? "outline" : "default"} onClick={() => setShowForm((v) => !v)} className="whitespace-nowrap">
                <Plus className="h-4 w-4" /> Tambah Karyawan
              </Button>
            )}
          </div>
        </div>
      </div>

      {reminders && (reminders.contracts.length > 0 || reminders.documents.length > 0) && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Segera Jatuh Tempo (30 hari ke depan)
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1.5">
            {reminders.contracts.map((c) => (
              <Link
                key={`c${c.id}`}
                href={`/hr/karyawan/${c.id}`}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-sm hover:underline"
              >
                <span>
                  Kontrak <span className="font-medium">{c.name}</span>
                  {c.outlet ? ` (${c.outlet})` : ""} berakhir
                </span>
                <span className="text-muted-foreground shrink-0">{formatDateId(c.contractEndDate)}</span>
              </Link>
            ))}
            {reminders.documents.map((d) => (
              <Link
                key={`d${d.id}`}
                href={`/hr/karyawan/${d.employeeId}`}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-sm hover:underline"
              >
                <span>
                  {DOC_TYPE_LABEL[d.type] ?? d.type} <span className="font-medium">{d.employee.name}</span> kedaluwarsa
                </span>
                <span className="text-muted-foreground shrink-0">{formatDateId(d.expiryDate)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Karyawan Baru (Manual)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Untuk karyawan lama yang tidak lewat proses Rekrutmen. Kandidat yang "Diterima" di Rekrutmen otomatis muncul di
              sini tanpa perlu ditambah manual.
            </p>
            <form onSubmit={handleSubmit} className="grid gap-4 max-w-lg">
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
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Batal</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "outlet" | "kantor")}>
          <TabsList>
            <TabsIndicator />
            <TabsTab value="outlet">Resto ({restoEmployees.length})</TabsTab>
            {!readOnly && <TabsTab value="kantor">Kantor ({kantorEmployees.length})</TabsTab>}
          </TabsList>
        </Tabs>
        <div className="relative w-full min-w-0 flex-1 sm:w-56 sm:flex-none">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Cari karyawan"
            placeholder="Cari nama, jabatan, outlet, kode..."
            className="pl-8 pr-8"
          />
          {search && (
            <button
              type="button"
              aria-label="Hapus pencarian"
              title="Hapus pencarian"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(["active", "resigned", "all"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80 hover:bg-muted/70"
            }`}
          >
            {s === "active" ? "Aktif" : s === "resigned" ? "Resign" : "Semua"} ({statusCounts[s]})
          </button>
        ))}
      </div>
      {q && (
        <p className="text-xs text-muted-foreground -mt-3">
          {tabEmployees.length} dari {tabEmployeesAll.length} karyawan cocok dengan &quot;{search}&quot;.
        </p>
      )}

      <Card className="min-w-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Jabatan</TableHead>
              <TableHead>Outlet</TableHead>
              <TableHead>Status Kepegawaian</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Kelengkapan</TableHead>
              <TableHead>WA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && tabEmployees.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  {q
                    ? `Tidak ada karyawan yang cocok dengan pencarian.`
                    : statusFilter !== "all"
                      ? `Tidak ada karyawan ${statusFilter === "active" ? "aktif" : "resign"} di ${tab === "outlet" ? "resto" : "kantor"}.`
                      : `Belum ada karyawan ${tab === "outlet" ? "resto" : "kantor"}.`}
                </TableCell>
              </TableRow>
            )}
            {tabEmployees.map((e) => {
              const hasKtp = e.documents.some((d) => d.type === "ktp");
              const completeness = computeCompleteness(e, hasKtp);
              return (
              <TableRow key={e.id}>
                <TableCell className="font-medium">
                  <Link href={`/hr/karyawan/${e.id}`} className="flex items-center gap-2 hover:underline">
                    <EmployeeAvatar photoUrl={e.photoUrl} name={e.name} size={24} />
                    {e.name}
                  </Link>
                  {e.employeeCode && <span className="text-xs text-muted-foreground ml-1.5">({e.employeeCode})</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.position || "-"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.outlet || "-"}</TableCell>
                <TableCell className="text-muted-foreground">{employmentStatusLabel(e.employmentStatus)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[e.status] ?? "outline"} className="font-normal">
                    {STATUS_LABEL[e.status] ?? e.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className={`text-sm tabular-nums font-medium ${completenessColor(completeness.percent)}`} title={completeness.missing.join(", ")}>
                    {completeness.percent}%
                  </span>
                </TableCell>
                <TableCell>
                  {e.phone ? (
                    <button
                      type="button"
                      title="Chat WhatsApp"
                      onClick={() => window.open(`https://wa.me/${toWaNumber(e.phone!)}`, "_blank")}
                      className="inline-flex items-center justify-center text-primary hover:text-primary/70 transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
