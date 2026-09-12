"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PiggyBank, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "../../components/AuthContext";
import { hasFullAccess } from "@/lib/roles";

type DailyRow = {
  date: string;
  omzet: number;
  usageCost: number;
  payrollCost: number;
  totalCost: number;
  grossProfit: number;
  hasSalesData: boolean;
  hasPayrollData: boolean;
};
type DailyReport = {
  startDate: string;
  endDate: string;
  outlet: string | null;
  outlets: string[];
  days: DailyRow[];
  totals: { omzet: number; usageCost: number; payrollCost: number; totalCost: number; grossProfit: number };
  warehouseError: string | null;
};

type Period = { id: number; label: string; startDate: string; endDate: string; status: string };
type Row = {
  outletName: string;
  isCentralKitchen: boolean;
  grossPayrollCost: number;
  dailyPayrollCost: number;
  usageCost: number;
  hasWarehouseData: boolean;
  totalCost: number;
  omzet: number;
  hasSalesData: boolean;
  lastSalesSyncAt: string | null;
  grossProfit: number;
  ckTransfer: { count: number; value: number } | null;
};
type Report = {
  period: { id: number; label: string; startDate: string; endDate: string };
  daysInPeriod: number;
  rows: Row[];
  grandTotal: number;
  grandOmzet: number;
  grandGrossProfit: number;
  warehouseError: string | null;
};

function fmtRupiah(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}Rp${Math.round(Math.abs(n)).toLocaleString("id-ID")}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmtDayLong(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
}
function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

const DAILY_OUTLET_ALL = "Semua Outlet";

function defaultDailyRange() {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return { start: toDateInput(start), end: toDateInput(end) };
}

export default function CostCenterPage() {
  const { user } = useAuthContext();
  const canSync = !!user && hasFullAccess(user);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState<string>("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialRange = defaultDailyRange();
  const [dailyStart, setDailyStart] = useState(initialRange.start);
  const [dailyEnd, setDailyEnd] = useState(initialRange.end);
  const [dailyOutlet, setDailyOutlet] = useState(DAILY_OUTLET_ALL);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState<string | null>(null);

  function loadDaily() {
    setDailyLoading(true);
    setDailyError(null);
    const params = new URLSearchParams({ start: dailyStart, end: dailyEnd });
    if (dailyOutlet !== DAILY_OUTLET_ALL) params.set("outlet", dailyOutlet);
    fetch(`/api/cost-center/daily?${params}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setDailyError(data.error ?? "Gagal memuat");
          setDailyReport(null);
          return;
        }
        setDailyReport(data);
      })
      .finally(() => setDailyLoading(false));
  }

  useEffect(loadDaily, [dailyStart, dailyEnd, dailyOutlet]);

  function applyPreset(days: number) {
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    setDailyStart(toDateInput(start));
    setDailyEnd(toDateInput(end));
  }

  function loadPeriods() {
    fetch("/api/payroll/periods?category=outlet")
      .then((r) => r.json())
      .then((data: (Period & { _count: { items: number } })[]) => {
        const final = data.filter((p) => p.status === "final");
        setPeriods(final);
        if (final.length > 0 && !periodId) setPeriodId(String(final[0].id));
      });
  }

  useEffect(loadPeriods, []);

  function loadReport() {
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
  }

  useEffect(loadReport, [periodId]);

  async function handleSync() {
    setSyncing(true);
    const res = await fetch("/api/cost-center/sync-sales", { method: "POST" });
    const data = await res.json();
    setSyncing(false);
    if (!res.ok) {
      toast.error("Gagal sync: " + data.error);
      return;
    }
    toast.success(`Omzet disinkron: ${data.totalRows} hari (${data.byOutlet.map((o: { outletName: string; days: number }) => `${o.outletName} ${o.days} hari`).join(", ")}).`);
    loadReport();
    loadDaily();
  }

  return (
    <div className="max-w-5xl grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-heading font-semibold tracking-tight">Cost Center</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            Biaya Gaji (HR) + Biaya Pemakaian Stok/Central Kitchen (Warehouse) + Omzet (POS) sampai Gross Profit, per outlet.
          </p>
        </div>
        {canSync && (
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="shrink-0">
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sinkron..." : "Sync Omzet Sekarang"}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dashboard Harian</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 grid gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">Dari</span>
              <input
                type="date"
                value={dailyStart}
                max={dailyEnd}
                onChange={(e) => e.target.value && setDailyStart(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">Sampai</span>
              <input
                type="date"
                value={dailyEnd}
                min={dailyStart}
                onChange={(e) => e.target.value && setDailyEnd(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">Outlet</span>
              <Select value={dailyOutlet} onValueChange={(v) => v && setDailyOutlet(v)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={DAILY_OUTLET_ALL}>{() => dailyOutlet}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DAILY_OUTLET_ALL}>{DAILY_OUTLET_ALL}</SelectItem>
                  {(dailyReport?.outlets ?? ["Gading Serpong", "Kelapa Gading", "Fatgai"]).map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={() => applyPreset(7)}>7 Hari</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => applyPreset(30)}>30 Hari</Button>
            </div>
          </div>

          {dailyError && <p className="text-sm text-destructive">{dailyError}</p>}
          {dailyReport?.warehouseError && (
            <div className="flex items-start gap-2 text-sm rounded-md border border-amber-500/40 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Gagal membaca data Warehouse: {dailyReport.warehouseError}. Omzet &amp; Biaya Gaji tetap tampil, Biaya Pemakaian sementara kosong.</span>
            </div>
          )}

          {dailyReport && (
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Omzet</TableHead>
                    <TableHead>Biaya Pemakaian</TableHead>
                    <TableHead>Biaya Gaji</TableHead>
                    <TableHead>Total Biaya</TableHead>
                    <TableHead>Gross Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyReport.days.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell className="font-medium whitespace-nowrap">{fmtDayLong(d.date)}</TableCell>
                      <TableCell className="tabular-nums">
                        {d.hasSalesData ? fmtRupiah(d.omzet) : <Badge variant="outline" className="font-normal">belum di-sync</Badge>}
                      </TableCell>
                      <TableCell className="tabular-nums">{fmtRupiah(d.usageCost)}</TableCell>
                      <TableCell className="tabular-nums">
                        {d.hasPayrollData ? fmtRupiah(d.payrollCost) : <Badge variant="outline" className="font-normal">blm ada periode</Badge>}
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">{fmtRupiah(d.totalCost)}</TableCell>
                      <TableCell className={`font-medium tabular-nums ${d.hasSalesData && d.grossProfit < 0 ? "text-destructive" : d.hasSalesData ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                        {d.hasSalesData ? fmtRupiah(d.grossProfit) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {dailyReport && (
            <div className="grid gap-1 pt-3 border-t text-sm">
              <div className="flex flex-wrap justify-end gap-x-6 gap-y-1">
                <p>Total Biaya: <span className="font-medium">{fmtRupiah(dailyReport.totals.totalCost)}</span></p>
                <p>Total Omzet: <span className="font-medium">{fmtRupiah(dailyReport.totals.omzet)}</span></p>
                <p>
                  Gross Profit:{" "}
                  <span className={`font-medium ${dailyReport.totals.grossProfit < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {fmtRupiah(dailyReport.totals.grossProfit)}
                  </span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground text-right">
                Biaya Gaji dihitung dari periode Payroll Outlet yang mencakup tanggal itu (draft atau final). Total Omzet/Gross Profit hanya menjumlah hari yang omzetnya sudah di-sync.
              </p>
            </div>
          )}

          {dailyLoading && <p className="text-sm text-muted-foreground">Memuat...</p>}
        </CardContent>
      </Card>

      <h2 className="text-lg font-heading font-semibold -mb-2">Laporan per Periode Payroll</h2>

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
                    <TableHead>Biaya Gaji</TableHead>
                    <TableHead>Biaya Pemakaian Stok</TableHead>
                    <TableHead>Total Biaya</TableHead>
                    <TableHead>Omzet</TableHead>
                    <TableHead>Gross Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((r) => (
                    <TableRow key={r.outletName} className={r.isCentralKitchen ? "bg-muted/30" : undefined}>
                      <TableCell className="font-medium">
                        {r.outletName}
                        {r.isCentralKitchen && (
                          <p className="text-xs text-muted-foreground font-normal">Central Kitchen &middot; di luar Total/Gross Profit gabungan</p>
                        )}
                        {r.ckTransfer && (
                          <p className="text-xs text-muted-foreground font-normal">
                            Terima dari CK: {r.ckTransfer.count} surat jalan &middot; {fmtRupiah(r.ckTransfer.value)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {fmtRupiah(r.grossPayrollCost)}
                        <p className="text-xs text-muted-foreground font-normal">{fmtRupiah(r.dailyPayrollCost)}/hari</p>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {r.hasWarehouseData ? fmtRupiah(r.usageCost) : <Badge variant="outline" className="font-normal">belum ada data</Badge>}
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">{fmtRupiah(r.totalCost)}</TableCell>
                      <TableCell className="tabular-nums">
                        {r.isCentralKitchen ? (
                          "-"
                        ) : r.hasSalesData ? (
                          <>
                            {fmtRupiah(r.omzet)}
                            {r.lastSalesSyncAt && (
                              <p className="text-xs text-muted-foreground font-normal">sync {fmtDateTime(r.lastSalesSyncAt)}</p>
                            )}
                          </>
                        ) : (
                          <Badge variant="outline" className="font-normal">belum di-sync</Badge>
                        )}
                      </TableCell>
                      <TableCell className={`font-medium tabular-nums ${r.grossProfit < 0 && !r.isCentralKitchen ? "text-destructive" : r.isCentralKitchen ? "" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {!r.isCentralKitchen && r.hasSalesData ? fmtRupiah(r.grossProfit) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <CardContent className="grid gap-1 pt-4 border-t text-sm">
              <div className="flex flex-wrap justify-end gap-x-6 gap-y-1">
                <p>Total Biaya: <span className="font-medium">{fmtRupiah(report.grandTotal)}</span></p>
                <p>Total Omzet: <span className="font-medium">{fmtRupiah(report.grandOmzet)}</span></p>
                <p>
                  Gross Profit:{" "}
                  <span className={`font-medium ${report.grandGrossProfit < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {fmtRupiah(report.grandGrossProfit)}
                  </span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground text-right">
                Central Kitchen dikecualikan dari semua total di atas. Total Omzet &amp; Gross Profit hanya menjumlah outlet yang omzetnya sudah di-sync.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}
    </div>
  );
}
