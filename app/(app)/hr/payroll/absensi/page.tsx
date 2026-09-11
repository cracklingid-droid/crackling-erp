"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Upload, AlertTriangle, CheckCircle2 } from "lucide-react";

type ImportResult = {
  totalRows: number;
  skippedRows: number;
  groupsFound: number;
  imported: number;
  unmatchedNames: string[];
};

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

  const headers = rows?.[0] ?? [];
  const preview = rows?.slice(1, 6) ?? [];

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setRows(null);
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
      setRows(data.rows);
      // reset mapping tiap ganti file
      setNameCol("");
      setDateCol("");
      setClockInCol("");
      setClockOutCol("");
      setDatetimeCol("");
    } catch (err) {
      toast.error("Gagal baca file: " + (err instanceof Error ? err.message : "unknown"));
    } finally {
      setParsing(false);
      e.target.value = "";
    }
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
      body: JSON.stringify({ rows, headerRowIndex: 0, mapping }),
    });
    setImporting(false);
    const data = await res.json();
    if (!res.ok) {
      toast.error("Gagal import: " + data.error);
      return;
    }
    setResult(data);
    toast.success(`${data.imported} rekap absensi berhasil disimpan.`);
  }

  return (
    <div className="max-w-4xl grid gap-6">
      <div>
        <Link href="/hr/payroll" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Payroll
        </Link>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Upload Data Absen</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Import file export mesin fingerprint/absensi digital (.xlsx atau .csv). Nama karyawan di file harus sama persis
          dengan nama di Database Karyawan supaya bisa dicocokkan.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Pilih File</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" disabled={parsing} onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> {parsing ? "Membaca file..." : "Pilih File"}
            </Button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
            {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
          </div>
        </CardContent>
      </Card>

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
