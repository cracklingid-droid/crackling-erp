"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Upload, AlertTriangle, CheckCircle2, Sparkles, Check, HelpCircle } from "lucide-react";

type ImportResult = {
  totalRows: number;
  skippedRows: number;
  groupsFound: number;
  imported: number;
  unmatchedNames: string[];
};

type AttendanceGroup = { employeeName: string; date: string; clockIn: string; clockOut: string };
type EmployeeOption = { id: number; name: string };
type NameMatchSuggestion = { employeeId: number; employeeName: string; score: number };
type NameMatch = {
  name: string;
  status: "exact" | "alias" | "suggested" | "none";
  employeeId: number | null;
  employeeName: string | null;
  suggestions: NameMatchSuggestion[];
};
type MachineReportData = {
  groups: AttendanceGroup[];
  employeeNames: string[];
  periodStart: string | null;
  periodEnd: string | null;
  nameMatches: NameMatch[];
  employees: EmployeeOption[];
};

function formatDateID(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// Jam masuk/pulang disimpan sbg "jam dinding" di komponen UTC (konvensi yang
// sama dipakai di seluruh sistem, lihat lib/attendance-parse.ts) - makanya
// ambil jam/menitnya langsung dari string ISO, BUKAN toLocaleTimeString()
// yang ikut zona waktu browser (bisa salah geser kalau server & browser
// beda zona waktu).
function formatTimeUTC(iso: string) {
  return iso.slice(11, 16);
}

export default function UploadAbsensiPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<string[][] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const [mode, setMode] = useState<"separate" | "combined">("separate");
  const [nameCol, setNameCol] = useState("");
  const [dateCol, setDateCol] = useState("");
  const [clockInCol, setClockInCol] = useState("");
  const [clockOutCol, setClockOutCol] = useState("");
  const [datetimeCol, setDatetimeCol] = useState("");
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectNote, setDetectNote] = useState<{ text: string; confidence: string } | null>(null);
  const [machineReport, setMachineReport] = useState<MachineReportData | null>(null);
  const [nameMatches, setNameMatches] = useState<Record<string, NameMatch>>({});
  const [confirmingName, setConfirmingName] = useState<string | null>(null);
  const [manualPickerFor, setManualPickerFor] = useState<string | null>(null);

  const headers = rows?.[headerRowIndex] ?? [];
  const preview = rows?.slice(headerRowIndex + 1, headerRowIndex + 6) ?? [];

  // Simpan konfirmasi HR bahwa 1 nama dari mesin absen = 1 karyawan
  // tertentu, sbg alias permanen (upload berikutnya otomatis kebaca tanpa
  // perlu dikonfirmasi ulang). Dipanggil saat HR klik "Ya, ini dia" pada
  // saran, atau pilih manual dari dropdown. Permintaan Kevin 2026-09-12.
  async function confirmNameMatch(rawName: string, employeeId: number, employeeName: string) {
    setConfirmingName(rawName);
    try {
      const res = await fetch("/api/payroll/attendance/name-aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineName: rawName, employeeId }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error("Gagal simpan konfirmasi: " + err.error);
        return;
      }
      setNameMatches((prev) => ({
        ...prev,
        [rawName]: { name: rawName, status: "alias", employeeId, employeeName, suggestions: [] },
      }));
      setManualPickerFor(null);
      toast.success(`"${rawName}" disimpan -> ${employeeName}. Upload absensi berikutnya otomatis kebaca nama ini.`);
    } finally {
      setConfirmingName(null);
    }
  }

  async function detectMapping(fileRows: string[][]) {
    setDetecting(true);
    setDetectNote(null);
    try {
      const res = await fetch("/api/payroll/attendance/suggest-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: fileRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Deteksi otomatis gagal (mis. API key belum diset) - HR tetap bisa pilih kolom manual seperti biasa.
        return;
      }
      setHeaderRowIndex(data.headerRowIndex ?? 0);
      setMode(data.mode === "combined" ? "combined" : "separate");
      if (data.nameColIndex != null) setNameCol(String(data.nameColIndex));
      if (data.dateColIndex != null) setDateCol(String(data.dateColIndex));
      if (data.clockInColIndex != null) setClockInCol(String(data.clockInColIndex));
      if (data.clockOutColIndex != null) setClockOutCol(String(data.clockOutColIndex));
      if (data.datetimeColIndex != null) setDatetimeCol(String(data.datetimeColIndex));
      setDetectNote({ text: data.note || "Kolom terdeteksi otomatis - silakan cek ulang sebelum import.", confidence: data.confidence });
    } catch {
      // diam-diam gagal, HR isi manual
    } finally {
      setDetecting(false);
    }
  }

  async function processFile(file: File) {
    setFileName(file.name);
    setResult(null);
    setRows(null);
    setMachineReport(null);
    setNameMatches({});
    setManualPickerFor(null);
    setParsing(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/payroll/attendance/parse", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Gagal baca file: " + data.error);
        return;
      }
      if (data.machineReport) {
        // Laporan langsung dari mesin fingerprint/absensi - sudah diparse
        // penuh di server, HR tinggal cek preview lalu import, tidak perlu
        // pilih kolom manual. Permintaan Kevin 2026-09-11.
        setMachineReport(data);
        const matches: Record<string, NameMatch> = {};
        for (const m of data.nameMatches ?? []) matches[m.name] = m;
        setNameMatches(matches);
        return;
      }
      setRows(data.rows);
      // reset mapping tiap ganti file
      setHeaderRowIndex(0);
      setNameCol("");
      setDateCol("");
      setClockInCol("");
      setClockOutCol("");
      setDatetimeCol("");
      setDetectNote(null);
      detectMapping(data.rows);
    } catch (err) {
      toast.error("Gagal baca file: " + (err instanceof Error ? err.message : "unknown"));
    } finally {
      setParsing(false);
    }
  }

  async function handleImportMachineReport() {
    if (!machineReport) return;
    setImporting(true);
    const res = await fetch("/api/payroll/attendance/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groups: machineReport.groups }),
    });
    setImporting(false);
    const data = await res.json();
    if (!res.ok) {
      toast.error("Gagal import: " + data.error);
      return;
    }
    setResult(data);
    toast.success(`${data.imported} rekap absensi berhasil disimpan.`);
    if (data.recalculatedPeriods?.length > 0) {
      toast.success(`Gaji Outlet otomatis dihitung ulang: ${data.recalculatedPeriods.join(", ")}.`);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  const canImport =
    !!nameCol && (mode === "combined" ? !!datetimeCol : !!dateCol && !!clockInCol);

  async function handleImport() {
    if (!rows || !canImport) return;
    setImporting(true);
    const mapping =
      mode === "combined"
        ? { mode: "combined" as const, nameColIndex: Number(nameCol), datetimeColIndex: Number(datetimeCol) }
        : {
            mode: "separate" as const,
            nameColIndex: Number(nameCol),
            dateColIndex: Number(dateCol),
            clockInColIndex: Number(clockInCol),
            clockOutColIndex: clockOutCol ? Number(clockOutCol) : null,
          };

    const res = await fetch("/api/payroll/attendance/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows, headerRowIndex, mapping }),
    });
    setImporting(false);
    const data = await res.json();
    if (!res.ok) {
      toast.error("Gagal import: " + data.error);
      return;
    }
    setResult(data);
    toast.success(`${data.imported} rekap absensi berhasil disimpan.`);
    if (data.recalculatedPeriods?.length > 0) {
      toast.success(`Gaji Outlet otomatis dihitung ulang: ${data.recalculatedPeriods.join(", ")}.`);
    }
  }

  return (
    <div className="max-w-4xl grid gap-6">
      <div>
        <Link href="/hr/payroll" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Payroll
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-heading font-semibold tracking-tight">Upload Data Absen</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Import file export mesin fingerprint/absensi digital (.xlsx, .xls, atau .csv). Kalau nama di mesin absen beda
              dari Database Karyawan (mis. nama panggilan), sistem akan menawarkan saran pencocokan sebelum diimport.
            </p>
          </div>
          <Link href="/hr/payroll/absensi/alias" className="shrink-0 text-sm text-primary hover:underline whitespace-nowrap">
            Kelola Alias Nama
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Pilih File</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`grid justify-items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
              dragActive ? "border-primary bg-primary/5" : "border-border/70"
            }`}
          >
            <Button type="button" variant="outline" disabled={parsing} onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> {parsing ? "Membaca file..." : "Pilih File"}
            </Button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
            <p className="text-sm text-muted-foreground">atau seret &amp; lepas file .xlsx/.xls/.csv ke sini</p>
            {fileName && <span className="text-sm font-medium">{fileName}</span>}
          </div>
        </CardContent>
      </Card>

      {machineReport && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> 2. Laporan Mesin Absensi Terdeteksi
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Format laporan langsung dari mesin fingerprint - kolomnya sudah otomatis terbaca, tidak perlu dicocokkan manual.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="text-sm grid gap-1">
              {machineReport.periodStart && machineReport.periodEnd && (
                <p>
                  Periode: <span className="font-medium">{formatDateID(machineReport.periodStart)} - {formatDateID(machineReport.periodEnd)}</span>
                </p>
              )}
              <p>
                <span className="font-medium">{machineReport.employeeNames.length}</span> karyawan,{" "}
                <span className="font-medium">{machineReport.groups.length}</span> rekap harian ditemukan.
              </p>
            </div>
            <div className="text-sm">
              <p className="text-muted-foreground mb-1.5">
                Nama karyawan yang terbaca - yang berwarna kuning/merah perlu dicek, mesin absen mungkin pakai nama panggilan
                beda dari Database Karyawan:
              </p>
              <div className="grid gap-1.5">
                {machineReport.employeeNames.map((n) => {
                  const match = nameMatches[n];
                  if (!match) return null;
                  return (
                    <NameMatchRow
                      key={n}
                      match={match}
                      employees={machineReport.employees}
                      confirming={confirmingName === n}
                      manualPickerOpen={manualPickerFor === n}
                      onOpenManualPicker={() => setManualPickerFor(n)}
                      onCloseManualPicker={() => setManualPickerFor(null)}
                      onConfirm={(employeeId, employeeName) => confirmNameMatch(n, employeeId, employeeName)}
                    />
                  );
                })}
              </div>
              {(() => {
                const unresolved = machineReport.employeeNames.filter((n) => {
                  const s = nameMatches[n]?.status;
                  return s === "suggested" || s === "none";
                }).length;
                return unresolved > 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {unresolved} nama belum dikonfirmasi - absen milik nama itu tetap
                    bisa diimport (dicek lagi di hasil akhir), tapi lebih aman dikonfirmasi/dipilih manual dulu.
                  </p>
                ) : null;
              })()}
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Detail data yang akan diimport (cek dulu tanggal &amp; jamnya sebelum klik Import):
              </p>
              <div className="max-h-80 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Jam Masuk</TableHead>
                      <TableHead>Jam Pulang</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...machineReport.groups]
                      .sort((a, b) => a.employeeName.localeCompare(b.employeeName) || a.date.localeCompare(b.date))
                      .map((g, i) => (
                        <TableRow key={i}>
                          <TableCell className="whitespace-nowrap">{g.employeeName}</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateID(g.date)}</TableCell>
                          <TableCell className="tabular-nums">{formatTimeUTC(g.clockIn)}</TableCell>
                          <TableCell className="tabular-nums">{formatTimeUTC(g.clockOut)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <Button onClick={handleImportMachineReport} disabled={importing}>
                {importing ? "Mengimpor..." : "Import Absensi"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {rows && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Pratinjau Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h, i) => (
                        <TableHead key={i} className="whitespace-nowrap">{h || `Kolom ${i + 1}`}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((r, i) => (
                      <TableRow key={i}>
                        {headers.map((_, ci) => (
                          <TableCell key={ci} className="whitespace-nowrap text-sm text-muted-foreground">{r[ci] ?? ""}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Cocokkan Kolom</CardTitle>
              {detecting && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" /> Mendeteksi struktur kolom otomatis...
                </p>
              )}
              {!detecting && detectNote && (
                <p className="text-xs text-primary flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> {detectNote.text} (keyakinan: {detectNote.confidence}) - tetap cek
                  ulang sebelum import.
                </p>
              )}
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Format Tanggal &amp; Jam di File</Label>
                <Select value={mode} onValueChange={(v) => v && setMode(v as "separate" | "combined")}>
                  <SelectTrigger className="w-full sm:w-auto">
                    <SelectValue>
                      {() => (mode === "separate" ? "Tanggal & Jam Terpisah" : "Tanggal+Jam Gabung (1 kolom, tiap baris 1 scan)")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="separate">Tanggal &amp; Jam Terpisah</SelectItem>
                    <SelectItem value="combined">Tanggal+Jam Gabung (1 kolom, tiap baris 1 scan)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Pilih opsi kedua kalau file-nya berupa log scan mentah (satu baris = satu kali scan, kolom waktu sudah
                  berisi tanggal+jam sekaligus) - sistem otomatis ambil scan pertama sebagai jam masuk & scan terakhir
                  sebagai jam pulang per karyawan per hari.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <ColumnPicker label="Kolom Nama Karyawan" headers={headers} value={nameCol} onChange={setNameCol} />
                {mode === "separate" ? (
                  <>
                    <ColumnPicker label="Kolom Tanggal" headers={headers} value={dateCol} onChange={setDateCol} />
                    <ColumnPicker label="Kolom Jam Masuk" headers={headers} value={clockInCol} onChange={setClockInCol} />
                    <ColumnPicker
                      label="Kolom Jam Pulang (opsional)"
                      headers={headers}
                      value={clockOutCol}
                      onChange={setClockOutCol}
                    />
                  </>
                ) : (
                  <ColumnPicker label="Kolom Tanggal+Jam (datetime)" headers={headers} value={datetimeCol} onChange={setDatetimeCol} />
                )}
              </div>

              <div>
                <Button onClick={handleImport} disabled={!canImport || importing}>
                  {importing ? "Mengimpor..." : "Import Absensi"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {result && (
        <Card className={result.unmatchedNames.length > 0 ? "border-destructive/40" : "border-primary/30"}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {result.unmatchedNames.length > 0 ? (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              )}
              Hasil Import
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p>{result.totalRows} baris dibaca, {result.groupsFound} rekap harian ditemukan, {result.imported} berhasil disimpan.</p>
            {result.skippedRows > 0 && (
              <p className="text-muted-foreground">{result.skippedRows} baris dilewati karena tanggal/jamnya tidak bisa dibaca.</p>
            )}
            {result.unmatchedNames.length > 0 && (
              <div>
                <p className="text-destructive font-medium">
                  {result.unmatchedNames.length} nama tidak cocok dengan Database Karyawan (data absennya tidak tersimpan):
                </p>
                <ul className="list-disc list-inside text-muted-foreground">
                  {result.unmatchedNames.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground mt-1">
                  Pastikan nama di file persis sama dengan nama di Database Karyawan, lalu upload ulang.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Baris 1 nama dari mesin absen + status pencocokan ke Database Karyawan.
// "exact"/"alias" tidak butuh aksi apa-apa; "suggested" tawarkan tombol
// konfirmasi 1-klik ke kandidat paling mirip; "none" langsung ke dropdown
// pilih manual. Konfirmasi (baik dari saran maupun manual) disimpan sbg
// alias permanen lewat onConfirm. Permintaan Kevin 2026-09-12.
function NameMatchRow({
  match,
  employees,
  confirming,
  manualPickerOpen,
  onOpenManualPicker,
  onCloseManualPicker,
  onConfirm,
}: {
  match: NameMatch;
  employees: EmployeeOption[];
  confirming: boolean;
  manualPickerOpen: boolean;
  onOpenManualPicker: () => void;
  onCloseManualPicker: () => void;
  onConfirm: (employeeId: number, employeeName: string) => void;
}) {
  if (match.status === "exact" || match.status === "alias") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs">
        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="font-medium">{match.name}</span>
        {match.status === "alias" && match.employeeName && (
          <span className="text-muted-foreground">→ {match.employeeName} (alias tersimpan)</span>
        )}
      </div>
    );
  }

  const sortedEmployees = [...employees].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="grid gap-1.5 rounded-lg border border-amber-300/60 bg-amber-50/50 px-2.5 py-1.5 text-xs dark:border-amber-800/60 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-center gap-2">
        <HelpCircle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
        <span className="font-medium">{match.name}</span>
        <span className="text-muted-foreground">
          {match.status === "suggested" ? "tidak ditemukan persis - mirip dengan:" : "tidak dikenali sama sekali di Database Karyawan"}
        </span>
      </div>
      {match.status === "suggested" && (
        <div className="flex flex-wrap gap-1.5">
          {match.suggestions.map((s) => (
            <Button
              key={s.employeeId}
              type="button"
              size="xs"
              variant="outline"
              disabled={confirming}
              onClick={() => onConfirm(s.employeeId, s.employeeName)}
            >
              Ya, {s.employeeName}
            </Button>
          ))}
        </div>
      )}
      {!manualPickerOpen ? (
        <button type="button" onClick={onOpenManualPicker} className="w-fit text-left text-muted-foreground hover:text-foreground hover:underline">
          {match.status === "suggested" ? "Bukan salah satu di atas? pilih manual" : "Pilih karyawan manual"}
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          <Select
            onValueChange={(v) => {
              if (!v) return;
              const emp = employees.find((e) => String(e.id) === v);
              if (emp) onConfirm(emp.id, emp.name);
            }}
          >
            <SelectTrigger className="h-7 w-56 text-xs">
              <SelectValue placeholder="Cari karyawan..." />
            </SelectTrigger>
            <SelectContent>
              {sortedEmployees.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button type="button" onClick={onCloseManualPicker} className="text-xs text-muted-foreground hover:text-foreground">
            Batal
          </button>
        </div>
      )}
    </div>
  );
}

function ColumnPicker({
  label,
  headers,
  value,
  onChange,
}: {
  label: string;
  headers: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Pilih kolom..." />
        </SelectTrigger>
        <SelectContent>
          {headers.map((h, i) => (
            <SelectItem key={i} value={String(i)}>{h || `Kolom ${i + 1}`}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
