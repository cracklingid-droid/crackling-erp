"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
  Store,
  Factory,
  Users,
  Receipt,
  AlertTriangle,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "../../../components/AuthContext";

// ============================================================================
// Business Dashboard - ringkasan level tinggi POV owner (tren, perbandingan
// outlet, pengeluaran terbesar, ringkasan HR), DIBANGUN DI ATAS angka yang
// SAMA PERSIS dgn Dashboard Harian yg sudah dipercaya (satu sumber:
// /api/cost-center/business-dashboard, pakai fungsi lib yg sama). Setiap
// angka bisa diklik - kartu outlet & titik tren membuka Dashboard Harian
// dgn rentang/outlet yg sama (?start&end&outlet, lihat readQueryParam di
// app/(app)/cost-center/page.tsx), item pengeluaran membuka rincian per
// outlet. Permintaan Kevin 2026-09-17 ("dashboard interaktif, semua angka
// bisa diklik utk membuktikan").
// ============================================================================

type TrendPoint = { date: string; omzet: number; grossProfit: number; hasSales: boolean };
type OutletRow = { outletName: string; omzet: number; usageCost: number; payrollCost: number; totalCost: number; grossProfit: number };
type TopExpenseItem = { itemName: string; totalCost: number; outletBreakdown: { outletName: string; totalCost: number }[] };
type DashboardData = {
  startDate: string;
  endDate: string;
  outlets: string[];
  totals: { omzet: number; totalCost: number; grossProfit: number };
  trend: TrendPoint[];
  byOutlet: OutletRow[];
  centralKitchen: { outletName: string; usageCost: number; payrollCost: number };
  topExpenses: TopExpenseItem[];
  hr: { headcountByOutlet: { outletName: string; count: number }[]; payrollTrend: { date: string; cost: number }[] };
  warehouseError: string | null;
};

function fmtRupiah(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}Rp${Math.round(Math.abs(n)).toLocaleString("id-ID")}`;
}
function fmtRupiahCompact(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}rb`;
  return `${sign}${abs}`;
}
function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
function fmtDateLong(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

function StatTile({ icon: Icon, tile, label, value, tone, sub }: { icon: LucideIcon; tile: string; label: string; value: string; tone?: "positive" | "negative"; sub?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tile}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-heading font-semibold tabular-nums truncate ${tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : tone === "negative" ? "text-destructive" : ""}`}>
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grafik tren Omzet & Gross Profit - 2 seri sama satuan (Rupiah) jadi 1
// sumbu (aturan dataviz: jangan pernah dual-axis). Garis tipis 2px, ujung
// data bulat, crosshair+tooltip hover (bar/dot/line semua dapat lapisan
// hover per skill dataviz), legend krn >=2 seri.
// ---------------------------------------------------------------------------
function TrendLineChart({ data, onPointClick }: { data: TrendPoint[]; onPointClick: (date: string) => void }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const W = 760;
  const H = 220;
  const padL = 64;
  const padR = 12;
  const padT = 14;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const values = data.flatMap((d) => [d.omzet, d.grossProfit]);
  const rawMax = Math.max(0, ...values);
  const rawMin = Math.min(0, ...values);
  const span = rawMax - rawMin || 1;
  const yMax = rawMax + span * 0.1;
  const yMin = rawMin - span * 0.1;

  const x = (i: number) => padL + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const zeroY = y(0);

  const pathFor = (key: "omzet" | "grossProfit") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");

  const yTicks = [yMin, yMin + (yMax - yMin) * 0.5, yMax];
  const xTickEvery = Math.max(1, Math.ceil(data.length / 7));

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((relX - padL) / plotW) * (data.length - 1));
    setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)));
  }

  const hovered = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto touch-none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
        onClick={() => hovered && onPointClick(hovered.date)}
        role="img"
        aria-label="Grafik tren Omzet dan Gross Profit"
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={padL - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground" fontSize={10}>
              {fmtRupiahCompact(t)}
            </text>
          </g>
        ))}
        <line x1={padL} x2={W - padR} y1={zeroY} y2={zeroY} stroke="var(--border)" strokeWidth={1} />

        {data.map((d, i) =>
          i % xTickEvery === 0 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
              {fmtDate(d.date)}
            </text>
          ) : null
        )}

        <path d={pathFor("omzet")} fill="none" stroke="var(--chart-2)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathFor("grossProfit")} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {hoverIdx !== null && hovered && (
          <>
            <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={padT} y2={padT + plotH} stroke="var(--foreground)" strokeOpacity={0.25} strokeWidth={1} />
            <circle cx={x(hoverIdx)} cy={y(hovered.omzet)} r={4} fill="var(--chart-2)" stroke="var(--card)" strokeWidth={1.5} />
            <circle cx={x(hoverIdx)} cy={y(hovered.grossProfit)} r={4} fill="var(--chart-1)" stroke="var(--card)" strokeWidth={1.5} />
          </>
        )}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-0 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: `${Math.min(85, Math.max(2, (x(hoverIdx!) / W) * 100))}%`,
            transform: (x(hoverIdx!) / W) * 100 > 70 ? "translateX(-100%)" : undefined,
          }}
        >
          <p className="font-medium mb-1">{fmtDateLong(hovered.date)}</p>
          <p className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--chart-2)" }} /> Omzet: <span className="tabular-nums font-medium">{fmtRupiah(hovered.omzet)}</span>
          </p>
          <p className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--chart-1)" }} /> Gross Profit:{" "}
            <span className={`tabular-nums font-medium ${hovered.grossProfit < 0 ? "text-destructive" : ""}`}>{fmtRupiah(hovered.grossProfit)}</span>
          </p>
          <p className="text-muted-foreground mt-0.5">Klik utk lihat rincian hari ini</p>
        </div>
      )}

      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--chart-2)" }} /> Omzet
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--chart-1)" }} /> Gross Profit
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ranking pengeluaran terbesar - magnitude sequential (1 hue, gelap = lebih
// besar) via panjang bar, label nilai langsung di tiap baris. Bukan chart
// kategori (bukan identitas item yang penting, tapi besarnya).
// ---------------------------------------------------------------------------
function TopExpenseBars({ items, onItemClick }: { items: TopExpenseItem[]; onItemClick: (item: TopExpenseItem) => void }) {
  const max = Math.max(1, ...items.map((i) => i.totalCost));
  return (
    <div className="grid gap-2">
      {items.map((item, i) => (
        <button
          key={item.itemName}
          type="button"
          onClick={() => onItemClick(item)}
          className="group text-left rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors min-w-0 w-full"
        >
          <div className="flex items-center justify-between gap-2 text-sm mb-1 min-w-0">
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-muted-foreground tabular-nums w-4 shrink-0">{i + 1}</span>
              <span className="truncate">{item.itemName}</span>
            </span>
            <span className="tabular-nums font-medium shrink-0 flex items-center gap-1">
              {fmtRupiah(item.totalCost)}
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(item.totalCost / max) * 100}%`, background: "var(--chart-3)" }} />
          </div>
        </button>
      ))}
      {items.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada data pemakaian stok pada rentang ini.</p>}
    </div>
  );
}

const RANGE_PRESETS = [
  { label: "7 Hari", days: 7 },
  { label: "30 Hari", days: 30 },
  { label: "90 Hari", days: 90 },
];

function defaultRange(days: number) {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { start: toDateInput(start), end: toDateInput(end) };
}

export default function BusinessDashboardPage() {
  useAuthContext();
  const initial = defaultRange(30);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expenseDetail, setExpenseDetail] = useState<TopExpenseItem | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/cost-center/business-dashboard?start=${start}&end=${end}`)
      .then((r) => {
        if (!r.ok) throw new Error("Gagal memuat dashboard");
        return r.json();
      })
      .then(setData)
      .catch(() => setError("Gagal memuat data. Coba muat ulang halaman."))
      .finally(() => setLoading(false));
  }, [start, end]);

  const activeDays = useMemo(() => Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1, [start, end]);

  function dashboardHarianLink(params: { outlet?: string }) {
    const qs = new URLSearchParams({ start, end });
    if (params.outlet) qs.set("outlet", params.outlet);
    return `/cost-center?${qs.toString()}`;
  }

  const rankedOutlets = useMemo(() => (data ? [...data.byOutlet].sort((a, b) => b.grossProfit - a.grossProfit) : []), [data]);
  const marginPct = data && data.totals.omzet > 0 ? (data.totals.grossProfit / data.totals.omzet) * 100 : null;

  return (
    <div className="max-w-5xl grid gap-6">
      <div>
        <Link href="/cost-center" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Cost Center
        </Link>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Business Dashboard</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-0.5">
          Ringkasan level tinggi - tren, perbandingan outlet, pengeluaran terbesar, & HR. Semua angka bisa diklik utk lihat rinciannya di
          Dashboard Harian.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Dari</span>
          <input
            type="date"
            value={start}
            max={end}
            onChange={(e) => e.target.value && setStart(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Sampai</span>
          <input
            type="date"
            value={end}
            min={start}
            onChange={(e) => e.target.value && setEnd(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="flex gap-1.5">
          {RANGE_PRESETS.map((p) => (
            <Button
              key={p.label}
              type="button"
              variant={activeDays === p.days ? "default" : "outline"}
              size="sm"
              onClick={() => {
                const r = defaultRange(p.days);
                setStart(r.start);
                setEnd(r.end);
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {data?.warehouseError && (
        <div className="flex items-start gap-2 text-sm rounded-md border border-amber-500/40 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <span>Gagal membaca data Warehouse: {data.warehouseError}. Biaya Pemakaian &amp; Pengeluaran Terbesar sementara kosong.</span>
        </div>
      )}

      {loading && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {!loading && data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile icon={TrendingUp} tile="icon-tile-2" label="Total Omzet" value={fmtRupiah(data.totals.omzet)} sub={`${activeDays} hari`} />
            <StatTile icon={Wallet} tile="icon-tile-4" label="Total Biaya" value={fmtRupiah(data.totals.totalCost)} sub="Gaji + Pemakaian, semua outlet" />
            <StatTile
              icon={data.totals.grossProfit < 0 ? TrendingDown : TrendingUp}
              tile="icon-tile-3"
              label="Gross Profit"
              value={fmtRupiah(data.totals.grossProfit)}
              tone={data.totals.grossProfit < 0 ? "negative" : "positive"}
              sub={marginPct !== null ? `Margin ${marginPct.toFixed(1)}%` : undefined}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tren Omzet &amp; Gross Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendLineChart
                data={data.trend}
                onPointClick={(date) => (window.location.href = `/cost-center?${new URLSearchParams({ start: date, end: date }).toString()}`)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Perbandingan Outlet</CardTitle>
              <p className="text-xs text-muted-foreground">Diurutkan dari Gross Profit tertinggi - klik utk lihat rincian harian outlet itu.</p>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {rankedOutlets.map((o) => (
                // <a> biasa (bukan <Link>) - SENGAJA, Dashboard Harian baca
                // ?start&end&outlet cuma sekali di useState initializer
                // (window.location.search), soft-navigation Next.js Link
                // TIDAK memicu mount ulang jadi query barunya tidak kebaca
                // (bug nyata ditemukan lewat verifikasi Playwright
                // 2026-09-17 - URL berubah benar tapi tanggal/outlet yang
                // tampil tetap default). <a> full reload memastikan selalu
                // kebaca benar.
                <a key={o.outletName} href={dashboardHarianLink({ outlet: o.outletName })} className="block">
                  <div className="rounded-lg border border-border p-3 hover:border-primary/50 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm flex items-center gap-1.5">
                        <Store className="h-3.5 w-3.5 text-muted-foreground" /> {o.outletName}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Omzet</p>
                        <p className="tabular-nums font-medium">{fmtRupiahCompact(o.omzet)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Biaya</p>
                        <p className="tabular-nums font-medium">{fmtRupiahCompact(o.totalCost)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Profit</p>
                        <p className={`tabular-nums font-medium ${o.grossProfit < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {fmtRupiahCompact(o.grossProfit)}
                        </p>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
              <a href={dashboardHarianLink({ outlet: "Joglo (Central Kitchen)" })} className="block">
                <div className="rounded-lg border border-dashed border-border p-3 hover:border-primary/50 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm flex items-center gap-1.5">
                      <Factory className="h-3.5 w-3.5 text-muted-foreground" /> Joglo (Central Kitchen)
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">Bukan titik jual (tanpa Omzet) - biaya produksi/waste saja.</p>
                  <p className="tabular-nums font-medium text-sm">{fmtRupiah(data.centralKitchen.usageCost)} biaya pemakaian</p>
                </div>
              </a>
            </CardContent>
          </Card>

          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" /> Pengeluaran Terbesar
                </CardTitle>
                <p className="text-xs text-muted-foreground">Item stok/bahan yang paling banyak makan biaya pemakaian - klik utk rincian per outlet.</p>
              </CardHeader>
              <CardContent>
                <TopExpenseBars items={data.topExpenses} onItemClick={setExpenseDetail} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Ringkasan HR
                </CardTitle>
                <p className="text-xs text-muted-foreground">Jumlah karyawan aktif per outlet.</p>
              </CardHeader>
              <CardContent className="grid gap-2">
                {data.hr.headcountByOutlet.map((h) => (
                  <div key={h.outletName} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">
                    <span>{h.outletName}</span>
                    <span className="tabular-nums font-medium">{h.count} orang</span>
                  </div>
                ))}
                <Link href="/hr/karyawan" className="text-xs text-primary hover:underline underline-offset-2 mt-1">
                  Lihat Database Karyawan &rarr;
                </Link>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Dialog open={!!expenseDetail} onOpenChange={(open) => !open && setExpenseDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{expenseDetail?.itemName}</DialogTitle>
          </DialogHeader>
          {expenseDetail && (
            <div className="grid gap-2">
              <p className="text-sm text-muted-foreground">
                Total biaya pemakaian {fmtRupiah(expenseDetail.totalCost)} sepanjang {fmtDate(start)} &ndash; {fmtDate(end)}, per outlet:
              </p>
              <div className="grid gap-1.5">
                {expenseDetail.outletBreakdown.map((o) => (
                  <div key={o.outletName} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">
                    <span>{o.outletName}</span>
                    <span className="tabular-nums font-medium">{fmtRupiah(o.totalCost)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
