"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PiggyBank,
  AlertTriangle,
  RefreshCw,
  CalendarDays,
  FileBarChart,
  TrendingUp,
  TrendingDown,
  Wallet,
  Store,
  type LucideIcon,
} from "lucide-react";
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

function StatTile({
  icon: Icon,
  tile,
  label,
  value,
  tone,
  sub,
}: {
  icon: LucideIcon;
  tile: string;
  label: string;
  value: string;
  tone?: "positive" | "negative";
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3 transition-colors hover:bg-background">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tile}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`text-lg font-heading font-semibold tabular-nums truncate ${
            tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : tone === "negative" ? "text-destructive" : ""
          }`}
        >
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
      </div>
    </div>
  );
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <TableBody>
      {[0, 1, 2, 3].map((i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}>
              <div className="h-4 animate-pulse rounded bg-muted" style={{ width: j === 0 ? "70%" : "50%" }} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
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

  function isActivePreset(days: number) {
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    return dailyStart === toDateInput(start) && dailyEnd === toDateInput(end);
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

      <Card className="transition-shadow hover:shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Dashboard Harian</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            {fmtDate(dailyStart)} &ndash; {fmtDate(dailyEnd)} &middot; {dailyOutlet}
          </p>
        </CardHeader>
        <CardContent className="pt-0 grid gap-4">
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">Dari</span>
              <input
                type="date"
                value={dailyStart}
                max={dailyEnd}
                onChange={(e) => e.target.value && setDailyStart(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:border-ring/60 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">Sampai</span>
              <input
                type="date"
                value={dailyEnd}
                min={dailyStart}
                onChange={(e) => e.target.value && setDailyEnd(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:border-ring/60 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
              <Button type="button" variant={isActivePreset(7) ? "default" : "outline"} size="sm" onClick={() => applyPreset(7)}>
                7 Hari
              </Button>
              <Button type="button" variant={isActivePreset(30) ? "default" : "outline"} size="sm" onClick={() => applyPreset(30)}>
                30 Hari
              </Button>
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
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile
                icon={TrendingUp}
                tile="icon-tile-2"
                label="Total Omzet"
                value={fmtRupiah(dailyReport.totals.omzet)}
                sub={dailyOutlet}
              />
              <StatTile
                icon={Wallet}
                tile="icon-tile-4"
                label="Total Biaya"
                value={fmtRupiah(dailyReport.totals.totalCost)}
                sub={`Gaji ${fmtRupiah(dailyReport.totals.payrollCost)} + Pemakaian ${fmtRupiah(dailyReport.totals.usageCost)}`}
              />
              <StatTile
                icon={dailyReport.totals.grossProfit < 0 ? TrendingDown : TrendingUp}
                tile="icon-tile-3"
                label="Gross Profit"
                value={fmtRupiah(dailyReport.totals.grossProfit)}
                tone={dailyReport.totals.grossProfit < 0 ? "negative" : "positive"}
              />
            </div>
          )}

          <div className="overflow-x-auto -mx-6 px-6 max-h-[26rem] overflow-y-auto rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Omzet</TableHead>
                  <TableHead>Biaya Pemakaian</TableHead>
                  <TableHead>Biaya Gaji</TableHead>
                  <TableHead>Total Biaya</TableHead>
                  <TableHead>Gross Profit</TableHead>
                </TableRow>
              </TableHeader>
              {dailyLoading && !dailyReport ? (
                <TableSkeleton cols={6} />
              ) : (
                <TableBody>
                  {dailyReport?.days.map((d) => {
                    const isQuiet = !d.hasSalesData && d.totalCost === 0;
                    return (
                      <TableRow key={d.date} className={isQuiet ? "text-muted-foreground/70" : undefined}>
                        <TableCell className="font-medium whitespace-nowrap">{fmtDayLong(d.date)}</TableCell>
                        <TableCell className="tabular-nums">
                          {d.hasSalesData ? fmtRupiah(d.omzet) : <Badge variant="outline" className="font-normal">belum di-sync</Badge>}
                        </TableCell>
                        <TableCell className="tabular-nums">{fmtRupiah(d.usageCost)}</TableCell>
                        <TableCell className="tabular-nums">
                          {d.hasPayrollData ? fmtRupiah(d.payrollCost) : <Badge variant="outline" className="font-normal">blm ada periode</Badge>}
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">{fmtRupiah(d.totalCost)}</TableCell>
                        <TableCell
                          className={`font-medium tabular-nums ${
                            d.hasSalesData && d.grossProfit < 0 ? "text-destructive" : d.hasSalesData ? "text-emerald-600 dark:text-emerald-400" : ""
                          }`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {d.hasSalesData && (d.grossProfit < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />)}
                            {d.hasSalesData ? fmtRupiah(d.grossProfit) : "-"}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              )}
            </Table>
          </div>

          {dailyReport && (
            <p className="text-xs text-muted-foreground text-right">
              Biaya Gaji dihitung dari periode Payroll Outlet yang mencakup tanggal itu (draft atau final). Total Omzet/Gross Profit di atas hanya menjumlah hari yang omzetnya sudah di-sync.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 -mb-2">
        <FileBarChart className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-heading font-semibold">Laporan per Periode Payroll</h2>
      </div>

      <Card className="transition-shadow hover:shadow-sm">
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
          {periods.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border px-3 py-2">
              Belum ada periode Payroll Outlet yang final.
            </p>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading && (
        <Card>
          <CardContent className="pt-6 grid gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </CardContent>
        </Card>
      )}

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

          <Card className="transition-shadow hover:shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">
                {report.period.label} &middot; {report.daysInPeriod} hari
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3 pb-4">
              <StatTile icon={TrendingUp} tile="icon-tile-2" label="Total Omzet" value={fmtRupiah(report.grandOmzet)} />
              <StatTile icon={Wallet} tile="icon-tile-4" label="Total Biaya" value={fmtRupiah(report.grandTotal)} />
              <StatTile
                icon={report.grandGrossProfit < 0 ? TrendingDown : TrendingUp}
                tile="icon-tile-3"
                label="Gross Profit"
                value={fmtRupiah(report.grandGrossProfit)}
                tone={report.grandGrossProfit < 0 ? "negative" : "positive"}
              />
            </CardContent>
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
                        <span className="inline-flex items-center gap-1.5">
                          <Store className="h-3.5 w-3.5 text-muted-foreground" />
                          {r.outletName}
                        </span>
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
              <p className="text-xs text-muted-foreground text-right">
                Central Kitchen dikecualikan dari semua total di atas. Total Omzet &amp; Gross Profit hanya menjumlah outlet yang omzetnya sudah di-sync.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
