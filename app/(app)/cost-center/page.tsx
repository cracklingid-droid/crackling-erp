"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  PiggyBank,
  AlertTriangle,
  RefreshCw,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Wallet,
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

type UsageDetailLine = { outletName: string; itemName: string; type: string; qty: number; totalCost: number };
type PayrollDetailEmployee = {
  employeeName: string;
  outletName: string;
  overtimeMinutes: number;
  baseSalary: number;
  partTimePay: number;
  mealAllowance: number;
  transportReimbursement: number;
  overtimePay: number;
  cost: number;
};
type DailyDetail = {
  date: string;
  outlet: string | null;
  usage: UsageDetailLine[];
  usageTotal: number;
  payroll: { employees: PayrollDetailEmployee[] } | null;
  warehouseError: string | null;
};

function fmtRupiah(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}Rp${Math.round(Math.abs(n)).toLocaleString("id-ID")}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function fmtQty(n: number) {
  return n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}
function formatMinutes(min: number) {
  if (min <= 0) return "-";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}j ${m}m`;
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
  const [syncing, setSyncing] = useState(false);

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

  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"usage" | "payroll">("usage");
  const [detailData, setDetailData] = useState<DailyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  function openDetail(date: string, tab: "usage" | "payroll") {
    setDetailTab(tab);
    setDetailDate(date);
  }

  useEffect(() => {
    if (!detailDate) return;
    setDetailLoading(true);
    setDetailData(null);
    const params = new URLSearchParams({ date: detailDate });
    if (dailyOutlet !== DAILY_OUTLET_ALL) params.set("outlet", dailyOutlet);
    fetch(`/api/cost-center/daily/detail?${params}`)
      .then((r) => r.json())
      .then(setDetailData)
      .finally(() => setDetailLoading(false));
  }, [detailDate, dailyOutlet]);

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
                        <TableCell className="tabular-nums">
                          {d.usageCost > 0 ? (
                            <button
                              type="button"
                              onClick={() => openDetail(d.date, "usage")}
                              className="underline decoration-dotted underline-offset-2 decoration-muted-foreground/60 transition-colors hover:text-primary hover:decoration-primary"
                            >
                              {fmtRupiah(d.usageCost)}
                            </button>
                          ) : (
                            fmtRupiah(d.usageCost)
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {d.hasPayrollData ? (
                            <button
                              type="button"
                              onClick={() => openDetail(d.date, "payroll")}
                              className="underline decoration-dotted underline-offset-2 decoration-muted-foreground/60 transition-colors hover:text-primary hover:decoration-primary"
                            >
                              {fmtRupiah(d.payrollCost)}
                            </button>
                          ) : (
                            <Badge variant="outline" className="font-normal">tdk ada absen</Badge>
                          )}
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
              Klik angka Biaya Pemakaian/Biaya Gaji utk lihat rinciannya. Total Omzet/Gross Profit di atas hanya menjumlah hari yang omzetnya sudah di-sync.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailDate} onOpenChange={(open) => !open && setDetailDate(null)}>
        <DialogContent className="w-[min(52rem,95vw)] sm:max-w-[min(52rem,95vw)] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailTab === "usage" ? "Rincian Biaya Pemakaian" : "Rincian Biaya Gaji"}</DialogTitle>
            <DialogDescription>
              {detailDate && fmtDayLong(detailDate)}
              {dailyOutlet !== DAILY_OUTLET_ALL && ` · ${dailyOutlet}`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-1.5">
            <Button type="button" size="xs" variant={detailTab === "usage" ? "default" : "outline"} onClick={() => setDetailTab("usage")}>
              Biaya Pemakaian
            </Button>
            <Button type="button" size="xs" variant={detailTab === "payroll" ? "default" : "outline"} onClick={() => setDetailTab("payroll")}>
              Biaya Gaji
            </Button>
          </div>

          {detailLoading && (
            <div className="grid gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-muted" />
              ))}
            </div>
          )}

          {!detailLoading && detailData && detailTab === "usage" && (
            <div className="grid gap-2">
              <p className="text-xs text-muted-foreground">
                Dijumlah dari transaksi stok keluar hari itu (Warehouse) - transfer antar outlet & proses produksi Central Kitchen tidak dihitung ganda, cuma pemakaian riil (terjual/waste).
              </p>
              {detailData.warehouseError && (
                <p className="text-sm text-destructive">Gagal membaca data Warehouse: {detailData.warehouseError}</p>
              )}
              {detailData.usage.length === 0 && !detailData.warehouseError && (
                <p className="text-sm text-muted-foreground">Tidak ada transaksi pemakaian stok pada tanggal ini.</p>
              )}
              {detailData.usage.length > 0 && (
                <div className="rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Biaya</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailData.usage.map((l, i) => (
                        <TableRow key={i}>
                          <TableCell className="whitespace-normal break-words">
                            <span className="font-medium">{l.itemName}</span>
                            <p className="text-xs text-muted-foreground font-normal">
                              {l.type}
                              {dailyOutlet === DAILY_OUTLET_ALL && ` · ${l.outletName}`}
                            </p>
                          </TableCell>
                          <TableCell className="tabular-nums text-right whitespace-nowrap">{fmtQty(l.qty)}</TableCell>
                          <TableCell className="tabular-nums text-right whitespace-nowrap">{fmtRupiah(l.totalCost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-sm text-right font-medium">Total: {fmtRupiah(detailData.usageTotal)}</p>
            </div>
          )}

          {!detailLoading && detailData && detailTab === "payroll" && (
            <div className="grid gap-2">
              <p className="text-xs text-muted-foreground">
                Karyawan yang benar-benar tercatat hadir pada tanggal ini saja, dengan biaya hari itu (uang makan/transport tarif harian penuh, gaji pokok dipecah rata per hari kerja standar, lembur dari jam kerja aktual hari itu).
              </p>
              {!detailData.payroll || detailData.payroll.employees.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada karyawan yang tercatat hadir pada tanggal ini.</p>
              ) : (
                <>
                  <div className="rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Karyawan</TableHead>
                          <TableHead className="text-right">Lembur</TableHead>
                          <TableHead className="text-right">Biaya Hari Ini</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailData.payroll.employees.map((e, i) => (
                          <TableRow key={i}>
                            <TableCell className="whitespace-normal break-words">
                              <span className="font-medium">{e.employeeName}</span>
                              {dailyOutlet === DAILY_OUTLET_ALL && (
                                <p className="text-xs text-muted-foreground font-normal">{e.outletName}</p>
                              )}
                            </TableCell>
                            <TableCell className="tabular-nums text-right whitespace-nowrap">{formatMinutes(e.overtimeMinutes)}</TableCell>
                            <TableCell className="tabular-nums text-right whitespace-nowrap font-medium">{fmtRupiah(e.cost)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-sm text-right font-medium">
                    Total: {fmtRupiah(detailData.payroll.employees.reduce((s, e) => s + e.cost, 0))}
                  </p>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
