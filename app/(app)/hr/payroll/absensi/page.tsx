"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Upload, AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";

type ImportResult = {
  totalRows: number;
  skippedRows: number;
  groupsFound: number;
  imported: number;
  unmatchedNames: string[];
};

type AttendanceGroup = { employeeName: string; date: string; clockIn: string; clockOut: string };
type MachineReportData = { groups: AttendanceGroup[]; employeeNames: string[]; periodStart: string | null; periodEnd: string | null };

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

  const headers = rows?.[headerRowIndex] ?? [];
  const preview = rows?.slice(headerRowIndex + 1, headerRowIndex + 6) ?? [];

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
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Upload Data Absen</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Import file export mesin fingerprint/absensi digital (.xlsx, .xls, atau .csv). Nama karyawan di file harus sama persis
          dengan nama di Database Karyawan supaya bisa dicocokkan.
        </p>
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
              <p className="text-muted-foreground mb-1">Nama karyawan yang terbaca (cek dulu sama persis dengan Database Karyawan):</p>
              <div className="flex flex-wrap gap-1.5">
                {machineReport.employeeNames.map((n) => (
                  <span key={n} className="rounded-full border px-2 py-0.5 text-xs">{n}</span>
                ))}
              </div>
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
