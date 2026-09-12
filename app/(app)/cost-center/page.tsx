"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PiggyBank, AlertTriangle } from "lucide-react";

type Period = { id: number; label: string; startDate: string; endDate: string; status: string };
type Row = {
  outletName: string;
  grossPayrollCost: number;
  dailyPayrollCost: number;
  usageCost: number;
  hasWarehouseData: boolean;
  totalCost: number;
};
type Report = {
  period: { id: number; label: string; startDate: string; endDate: string };
  daysInPeriod: number;
  rows: Row[];
  grandTotal: number;
  warehouseError: string | null;
};

function fmtRupiah(n: number) {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function CostCenterPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState<string>("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/payroll/periods?category=outlet")
      .then((r) => r.json())
      .then((data: (Period & { _count: { items: number } })[]) => {
        const final = data.filter((p) => p.status === "final");
        setPeriods(final);
        if (final.length > 0) setPeriodId(String(final[0].id));
      });
  }, []);

  useEffect(() => {
    if (!periodId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/cost-center?periodId=${periodId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setError(data.error ?? "Gagal memuat");
          setReport(null);
          return;
        }
        setReport(data);
      })
      .finally(() => setLoading(false));
  }, [periodId]);

  return (
    <div className="max-w-4xl grid gap-6">
      <div>
        <div className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Cost Center</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-0.5">
          Biaya operasional per outlet - Biaya Gaji (HR) &amp; Biaya Pemakaian Stok/Central Kitchen (Warehouse).
          Omzet &amp; Gross Profit menyusul setelah data omzet harian (Google Sheets) terhubung.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Periode (Payroll Outlet, final)</span>
            <Select value={periodId} onValueChange={(v) => v && setPeriodId(v)}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Pilih periode...">
                  {() => periods.find((p) => String(p.id) === periodId)?.label ?? "Pilih periode..."}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.label} ({fmtDate(p.startDate)} - {fmtDate(p.endDate)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {periods.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada periode Payroll Outlet yang final.</p>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {report && (
        <>
          {report.warehouseError && (
            <Card className="border-amber-500/40">
              <CardContent className="pt-6 flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Gagal membaca data Warehouse: {report.warehouseError}. Biaya Gaji tetap ditampilkan, kolom Biaya
                  Pemakaian sementara kosong.
                </span>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {report.period.label} &middot; {report.daysInPeriod} hari
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Biaya Gaji (periode)</TableHead>
                    <TableHead>Biaya Gaji/Hari</TableHead>
                    <TableHead>Biaya Pemakaian Stok</TableHead>
                    <TableHead>Total Biaya</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((r) => (
                    <TableRow key={r.outletName}>
                      <TableCell className="font-medium">{r.outletName}</TableCell>
                      <TableCell className="tabular-nums">{fmtRupiah(r.grossPayrollCost)}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{fmtRupiah(r.dailyPayrollCost)}</TableCell>
                      <TableCell className="tabular-nums">
                        {r.hasWarehouseData ? fmtRupiah(r.usageCost) : <Badge variant="outline" className="font-normal">belum ada data</Badge>}
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">{fmtRupiah(r.totalCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <CardContent className="flex justify-end pt-4 border-t">
              <p className="text-sm font-medium">Total Semua Outlet: {fmtRupiah(report.grandTotal)}</p>
            </CardContent>
          </Card>
        </>
      )}

      {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}
    </div>
  );
}
