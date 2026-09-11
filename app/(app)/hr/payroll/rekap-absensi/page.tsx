"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";
import { getDefaultPeriodRange, toDateInputValue } from "@/lib/payroll-period-cycle";

type RecapRow = {
  id: number;
  name: string;
  position: string | null;
  outlet: string | null;
  daysPresent: number;
  overtimeMinutes: number;
  totalMinutes: number;
  lateCount: number;
  workSchedule: string | null;
};

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}j ${m}m`;
}

const { start: defaultStart, end: defaultEnd } = getDefaultPeriodRange();

export default function RekapAbsensiPage() {
  const [startDate, setStartDate] = useState(toDateInputValue(defaultStart));
  const [endDate, setEndDate] = useState(toDateInputValue(defaultEnd));
  const [rows, setRows] = useState<RecapRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/api/payroll/attendance/recap?start=${startDate}&end=${endDate}`)
      .then((r) => r.json())
      .then(setRows)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div className="max-w-4xl grid gap-6">
      <div>
        <Link href="/hr/payroll" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Payroll
        </Link>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Rekap Absensi</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Ringkasan hari hadir, keterlambatan & jam kerja per karyawan dalam satu rentang tanggal. Default siklus 21 s.d.
          20 bulan berikutnya (gajian tanggal 25) - rentang tetap bisa diubah bebas kalau perlu penyesuaian sementara.
          Kolom Terlambat cuma terisi utk karyawan yang sudah diisi "Jadwal Kerja" di Database Karyawan.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label>Dari Tanggal</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-auto" />
          </div>
          <div className="grid gap-1.5">
            <Label>Sampai Tanggal</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-auto" />
          </div>
          <Button onClick={load} disabled={loading}>{loading ? "Memuat..." : "Tampilkan"}</Button>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Jabatan / Outlet</TableHead>
                <TableHead>Hari Hadir</TableHead>
                <TableHead>Terlambat</TableHead>
                <TableHead>Total Jam Kerja</TableHead>
                <TableHead>Jam Lembur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows?.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground">Tidak ada karyawan aktif.</TableCell></TableRow>
              )}
              {rows?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <Link href={`/hr/karyawan/${r.id}`} className="hover:underline">{r.name}</Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[r.position, r.outlet].filter(Boolean).join(" · ") || "-"}
                  </TableCell>
                  <TableCell className={`tabular-nums ${r.daysPresent === 0 ? "text-muted-foreground" : ""}`}>
                    {r.daysPresent === 0 ? "Tidak ada data" : r.daysPresent}
                  </TableCell>
                  <TableCell className={`tabular-nums text-sm ${r.lateCount > 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {r.workSchedule ? `${r.lateCount} kali` : "-"}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm text-muted-foreground">{formatHours(r.totalMinutes)}</TableCell>
                  <TableCell className="tabular-nums text-sm text-muted-foreground">{formatHours(r.overtimeMinutes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
