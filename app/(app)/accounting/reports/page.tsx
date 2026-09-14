"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTab, TabsIndicator, TabsPanel } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, Lock, Unlock, Printer, Plus, X } from "lucide-react";
import { SELLING_OUTLET_NAMES } from "@/lib/accounting-outlets";

type Row = { accountId: number; code: string; name: string; type: string; subType: string | null; parentId: number | null; debit: number; credit: number; balance: number };
type Section = { items: Row[]; total: number };

function fmtRp(n: number): string {
  return (n < 0 ? "-Rp" : "Rp") + Math.abs(n).toLocaleString("id-ID");
}
function fmtDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}
function firstOfMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function thisMonth() {
  return todayIso().slice(0, 7);
}

// Jurnal yang boleh dihapus dari Jurnal Umum (tanpa dokumen sumber di modul
// lain) - sama dgn DELETABLE_SOURCES di app/api/accounting/journal/[id].
const DELETABLE = new Set(["MANUAL", "BANK_ADJUSTMENT", "AR_RECEIPT", "OPENING_BALANCE"]);

const SOURCE_LABEL: Record<string, string> = {
  RECORD_SALES: "Record Sales",
  COGS_SYNC: "HPP",
  DIRECT_EXPENSE: "Direct Expense",
  DEPRECIATION: "Penyusutan",
  BANK_ADJUSTMENT: "Jurnal Bank",
  AR_RECEIPT: "Penerimaan Penjualan",
  OPENING_BALANCE: "Saldo Awal",
  FIXED_ASSET_ACQUISITION: "Perolehan Aset",
  MANUAL: "Manual",
};

export default function ReportsPage() {
  const [tab, setTab] = useState("pl");
  const [start, setStart] = useState(firstOfMonth());
  const [end, setEnd] = useState(todayIso());
  const [outlet, setOutlet] = useState("");

  return (
    <div className="max-w-5xl grid gap-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Laporan Keuangan</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Semua angka dihitung langsung dari buku besar (jurnal) - Laba Rugi, Neraca, Arus Kas, Jurnal Umum, Catatan (CALK), dan
          penguncian periode.
        </p>
      </div>

      <Card className="min-w-0 print:hidden">
        <CardContent className="pt-6 flex flex-col sm:flex-row flex-wrap gap-3 sm:items-end">
          <div className="grid gap-1.5">
            <Label>Dari</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full sm:w-40" />
          </div>
          <div className="grid gap-1.5">
            <Label>Sampai / per tanggal</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full sm:w-40" />
          </div>
          <div className="grid gap-1.5">
            <Label>Outlet</Label>
            <Select value={outlet || "all"} onValueChange={(v) => setOutlet(v === "all" ? "" : v ?? "")}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue>{() => outlet || "Konsolidasi (semua)"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Konsolidasi (semua)</SelectItem>
                {SELLING_OUTLET_NAMES.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
                <SelectItem value="Joglo (Central Kitchen)">Joglo (Central Kitchen)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => window.print()} className="sm:ml-auto">
            <Printer className="h-3.5 w-3.5" /> Print / PDF
          </Button>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList className="print:hidden">
          <TabsIndicator />
          <TabsTab value="pl">Laba Rugi</TabsTab>
          <TabsTab value="bs">Neraca</TabsTab>
          <TabsTab value="cf">Arus Kas</TabsTab>
          <TabsTab value="journal">Jurnal Umum</TabsTab>
          <TabsTab value="notes">Catatan</TabsTab>
          <TabsTab value="periods">Kunci Periode</TabsTab>
        </TabsList>
        <TabsPanel value="pl"><ProfitLoss start={start} end={end} outlet={outlet} /></TabsPanel>
        <TabsPanel value="bs"><BalanceSheet end={end} outlet={outlet} /></TabsPanel>
        <TabsPanel value="cf"><CashFlow start={start} end={end} outlet={outlet} /></TabsPanel>
        <TabsPanel value="journal"><GeneralJournal start={start} end={end} /></TabsPanel>
        <TabsPanel value="notes"><Notes /></TabsPanel>
        <TabsPanel value="periods"><Periods /></TabsPanel>
      </Tabs>
    </div>
  );
}

function useReport<T>(params: Record<string, string>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(params);
  useEffect(() => {
    setData(null);
    setError(null);
    fetch(`/api/accounting/reports?${new URLSearchParams(params)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Gagal memuat laporan");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { data, error };
}

function SectionTable({ title, section, negate }: { title: string; section: Section; negate?: boolean }) {
  return (
    <>
      <TableRow className="bg-muted/40">
        <TableCell colSpan={2} className="font-semibold">{title}</TableCell>
      </TableRow>
      {section.items.length === 0 && (
        <TableRow>
          <TableCell colSpan={2} className="text-sm text-muted-foreground pl-6">-</TableCell>
        </TableRow>
      )}
      {section.items.map((r) => (
        <TableRow key={r.accountId}>
          <TableCell className={r.parentId ? "pl-8" : "pl-6"}>
            <span className="font-mono text-xs text-muted-foreground mr-2">{r.code}</span>
            {r.name}
          </TableCell>
          <TableCell className="text-right tabular-nums">{fmtRp(negate ? -r.balance : r.balance)}</TableCell>
        </TableRow>
      ))}
      <TableRow>
        <TableCell className="pl-6 font-medium">Total {title}</TableCell>
        <TableCell className="text-right tabular-nums font-medium">{fmtRp(negate ? -section.total : section.total)}</TableCell>
      </TableRow>
    </>
  );
}

function LedgerStartNote({ ledgerStart, hasOpening }: { ledgerStart: string | null; hasOpening?: boolean }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <p>
        Buku besar mulai dari transaksi pertama {fmtDate(ledgerStart)}.{" "}
        {hasOpening === false && "Saldo awal (kas, persediaan, aset, modal) BELUM diinput - Neraca/Arus Kas belum lengkap sampai jurnal Saldo Awal dibuat."}
      </p>
    </div>
  );
}

function ProfitLoss({ start, end, outlet }: { start: string; end: string; outlet: string }) {
  type PL = { revenue: Section; cogs: Section; expenses: Section; netIncome: number; ledgerStart: string | null };
  const { data, error } = useReport<PL>({ type: "pl", start, end, ...(outlet ? { outlet } : {}) });
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Menghitung...</p>;
  const gross = data.revenue.total - data.cogs.total;
  return (
    <Card className="min-w-0">
      <CardContent className="pt-6 grid gap-4 min-w-0">
        <div>
          <h2 className="font-heading font-semibold text-lg">Laporan Laba Rugi</h2>
          <p className="text-sm text-muted-foreground">{fmtDate(start)} - {fmtDate(end)} &middot; {outlet || "Konsolidasi"}</p>
        </div>
        <div className="overflow-x-auto -mx-6 px-6 min-w-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Akun</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <SectionTable title="Pendapatan" section={data.revenue} />
              <SectionTable title="Beban Pokok Penjualan (HPP)" section={data.cogs} />
              <TableRow className="bg-muted/60">
                <TableCell className="font-semibold">Laba Kotor</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{fmtRp(gross)}</TableCell>
              </TableRow>
              <SectionTable title="Beban Operasional" section={data.expenses} />
              <TableRow className="bg-muted/60">
                <TableCell className="font-semibold">Laba Bersih</TableCell>
                <TableCell className={`text-right tabular-nums font-semibold ${data.netIncome < 0 ? "text-red-600" : "text-emerald-700"}`}>{fmtRp(data.netIncome)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <LedgerStartNote ledgerStart={data.ledgerStart} />
      </CardContent>
    </Card>
  );
}

function BalanceSheet({ end, outlet }: { end: string; outlet: string }) {
  type BS = { assets: Section; liabilities: Section; equity: Section; currentEarnings: number; totalAssets: number; totalLiabilitiesEquity: number; ledgerStart: string | null; hasOpeningBalance: boolean };
  const { data, error } = useReport<BS>({ type: "bs", end, ...(outlet ? { outlet } : {}) });
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Menghitung...</p>;
  const balanced = data.totalAssets === data.totalLiabilitiesEquity;
  return (
    <Card className="min-w-0">
      <CardContent className="pt-6 grid gap-4 min-w-0">
        <div>
          <h2 className="font-heading font-semibold text-lg">Neraca (Balance Sheet)</h2>
          <p className="text-sm text-muted-foreground">Per {fmtDate(end)} &middot; {outlet || "Konsolidasi"}</p>
        </div>
        <div className="overflow-x-auto -mx-6 px-6 min-w-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Akun</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <SectionTable title="Aset" section={data.assets} />
              <SectionTable title="Liabilitas" section={data.liabilities} />
              <SectionTable title="Ekuitas" section={data.equity} />
              <TableRow>
                <TableCell className="pl-6">Laba (Rugi) Berjalan</TableCell>
                <TableCell className="text-right tabular-nums">{fmtRp(data.currentEarnings)}</TableCell>
              </TableRow>
              <TableRow className="bg-muted/60">
                <TableCell className="font-semibold">Total Liabilitas + Ekuitas</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{fmtRp(data.totalLiabilitiesEquity)}</TableCell>
              </TableRow>
              <TableRow className="bg-muted/60">
                <TableCell className="font-semibold">Total Aset</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{fmtRp(data.totalAssets)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <p className={`text-sm ${balanced ? "text-emerald-700" : "text-red-600"}`}>
          {balanced ? "Aset = Liabilitas + Ekuitas (balance)." : `Tidak balance - selisih ${fmtRp(data.totalAssets - data.totalLiabilitiesEquity)} (periksa jurnal manual / akun tanpa tipe yang benar).`}
        </p>
        <LedgerStartNote ledgerStart={data.ledgerStart} hasOpening={data.hasOpeningBalance} />
      </CardContent>
    </Card>
  );
}

function CashFlow({ start, end, outlet }: { start: string; end: string; outlet: string }) {
  type CFRow = { code: string; name: string; type: string; amount: number };
  type CFSection = { items: CFRow[]; total: number };
  type CF = { openingCash: number; operating: CFSection; investing: CFSection; financing: CFSection; other: CFSection; netChange: number; closingCash: number; ledgerStart: string | null };
  const { data, error } = useReport<CF>({ type: "cf", start, end, ...(outlet ? { outlet } : {}) });
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Menghitung...</p>;
  const Sec = ({ title, s }: { title: string; s: CFSection }) => (
    <>
      <TableRow className="bg-muted/40">
        <TableCell colSpan={2} className="font-semibold">{title}</TableCell>
      </TableRow>
      {s.items.length === 0 && (
        <TableRow>
          <TableCell colSpan={2} className="text-sm text-muted-foreground pl-6">-</TableCell>
        </TableRow>
      )}
      {s.items.map((r) => (
        <TableRow key={r.code}>
          <TableCell className="pl-6">
            <span className="font-mono text-xs text-muted-foreground mr-2">{r.code}</span>
            {r.name}
          </TableCell>
          <TableCell className={`text-right tabular-nums ${r.amount < 0 ? "text-red-600 dark:text-red-400" : ""}`}>{fmtRp(r.amount)}</TableCell>
        </TableRow>
      ))}
      <TableRow>
        <TableCell className="pl-6 font-medium">Kas bersih dari {title.toLowerCase()}</TableCell>
        <TableCell className="text-right tabular-nums font-medium">{fmtRp(s.total)}</TableCell>
      </TableRow>
    </>
  );
  return (
    <Card className="min-w-0">
      <CardContent className="pt-6 grid gap-4 min-w-0">
        <div>
          <h2 className="font-heading font-semibold text-lg">Laporan Arus Kas (metode langsung)</h2>
          <p className="text-sm text-muted-foreground">{fmtDate(start)} - {fmtDate(end)} &middot; {outlet || "Konsolidasi"} &middot; akun Kas &amp; Bank (1-10xx)</p>
        </div>
        <div className="overflow-x-auto -mx-6 px-6 min-w-0">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Saldo kas awal periode</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{fmtRp(data.openingCash)}</TableCell>
              </TableRow>
              <Sec title="Aktivitas Operasi" s={data.operating} />
              <Sec title="Aktivitas Investasi" s={data.investing} />
              <Sec title="Aktivitas Pendanaan" s={data.financing} />
              {data.other.items.length > 0 && <Sec title="Lainnya (belum terklasifikasi)" s={data.other} />}
              <TableRow className="bg-muted/60">
                <TableCell className="font-semibold">Kenaikan (penurunan) kas bersih</TableCell>
                <TableCell className={`text-right tabular-nums font-semibold ${data.netChange < 0 ? "text-red-600" : "text-emerald-700"}`}>{fmtRp(data.netChange)}</TableCell>
              </TableRow>
              <TableRow className="bg-muted/60">
                <TableCell className="font-semibold">Saldo kas akhir periode</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{fmtRp(data.closingCash)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <LedgerStartNote ledgerStart={data.ledgerStart} />
      </CardContent>
    </Card>
  );
}

function GeneralJournal({ start, end }: { start: string; end: string }) {
  type Line = { id: number; debit: number; credit: number; description: string | null; outletName: string | null; account: { code: string; name: string } };
  type Entry = { id: number; date: string; memo: string; sourceType: string; sourceId: string | null; outletName: string | null; isLocked: boolean; lines: Line[]; createdBy: { name: string } | null };
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sourceType, setSourceType] = useState("");
  const [search, setSearch] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setEntries(null);
    const params = new URLSearchParams({ start, end, page: String(page) });
    if (sourceType) params.set("sourceType", sourceType);
    if (search.trim()) params.set("search", search.trim());
    fetch(`/api/accounting/journal?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries);
        setTotal(d.total);
      });
  }, [start, end, page, sourceType, search, reloadKey]);

  const totalPages = Math.max(1, Math.ceil(total / 40));
  return (
    <Card className="min-w-0">
      <CardContent className="pt-6 grid gap-4 min-w-0">
        <div className="flex flex-col sm:flex-row gap-2">
          <Button size="sm" onClick={() => setManualOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Jurnal Manual / Saldo Awal
          </Button>
          {manualOpen && <ManualJournalDialog onClose={() => setManualOpen(false)} onDone={() => { setManualOpen(false); setReloadKey((k) => k + 1); }} />}
          <Select value={sourceType || "all"} onValueChange={(v) => { setSourceType(v === "all" ? "" : v ?? ""); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue>{() => (sourceType ? SOURCE_LABEL[sourceType] ?? sourceType : "Semua sumber")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua sumber</SelectItem>
              {Object.entries(SOURCE_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input className="w-full sm:w-72" placeholder="Cari memo..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <span className="text-sm text-muted-foreground sm:ml-auto self-center">{total.toLocaleString("id-ID")} jurnal</span>
        </div>
        {!entries && <p className="text-sm text-muted-foreground">Memuat...</p>}
        {entries && entries.length === 0 && <p className="text-sm text-muted-foreground">Belum ada jurnal di rentang ini.</p>}
        {entries && entries.length > 0 && (
          <div className="grid gap-3">
            {entries.map((e) => (
              <div key={e.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">#{e.id}</span>
                  <span className="font-medium">{fmtDate(e.date)}</span>
                  <Badge variant="outline" className="font-normal">{SOURCE_LABEL[e.sourceType] ?? e.sourceType}</Badge>
                  {e.outletName && <Badge variant="outline" className="font-normal">{e.outletName}</Badge>}
                  {e.isLocked && <Badge variant="outline" className="font-normal"><Lock className="h-3 w-3 mr-1" />terkunci</Badge>}
                  <span className="text-muted-foreground">{e.memo}</span>
                  {!e.isLocked && DELETABLE.has(e.sourceType) && (
                    <button
                      type="button"
                      className="ml-auto text-xs text-destructive hover:underline"
                      onClick={async () => {
                        if (!confirm(`Hapus jurnal #${e.id}? Ditolak kalau sudah direkonsiliasi.`)) return;
                        const res = await fetch(`/api/accounting/journal/${e.id}`, { method: "DELETE" });
                        if (!res.ok) return toast.error((await res.json()).error ?? "Gagal menghapus.");
                        toast.success("Jurnal dihapus.");
                        setPage((p) => p);
                        setEntries((cur) => cur?.filter((x) => x.id !== e.id) ?? null);
                      }}
                    >
                      Hapus
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto -mx-3 px-3 min-w-0 mt-2">
                  <Table>
                    <TableBody>
                      {e.lines.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className={`text-sm ${l.credit ? "pl-8" : ""}`}>
                            <span className="font-mono text-xs text-muted-foreground mr-2">{l.account.code}</span>
                            {l.account.name}
                            {l.description && <span className="text-muted-foreground"> - {l.description}</span>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm w-36">{l.debit ? fmtRp(l.debit) : ""}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm w-36">{l.credit ? fmtRp(l.credit) : ""}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        )}
        {total > 40 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Halaman {page} dari {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Sebelumnya</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Berikutnya</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Jurnal bebas (Manual / Saldo Awal) - satu-satunya pintu input jurnal
// tanpa dokumen sumber. Saldo Awal: waktu buku besar mulai dipakai, isi
// saldo kas/bank, persediaan, aset tetap, utang, modal per tanggal mulai
// (keputusan tanggalnya milik Kevin - lihat plan).
function ManualJournalDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  type Acc = { id: number; code: string; name: string; type: string; isActive: boolean };
  type L = { accountId: string; debit: string; credit: string; description: string };
  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [date, setDate] = useState(todayIso());
  const [memo, setMemo] = useState("");
  const [sourceType, setSourceType] = useState("MANUAL");
  const [lines, setLines] = useState<L[]>([
    { accountId: "", debit: "", credit: "", description: "" },
    { accountId: "", debit: "", credit: "", description: "" },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/accounting/coa").then((r) => r.json()).then((d: Acc[]) => setAccounts(d.filter((a) => a.isActive && !a.code.endsWith("-0000"))));
  }, []);

  const parseRp = (s: string) => Number(s.replace(/\D/g, "")) || 0;
  const totalDebit = lines.reduce((s, l) => s + parseRp(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + parseRp(l.credit), 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;
  const accLabel = (id: string) => {
    const a = accounts.find((x) => String(x.id) === id);
    return a ? `${a.code} - ${a.name}` : "Pilih akun...";
  };
  const patch = (i: number, p: Partial<L>) => setLines((c) => c.map((l, idx) => (idx === i ? { ...l, ...p } : l)));

  async function save() {
    if (!memo.trim()) return toast.error("Keterangan wajib diisi.");
    const payload = lines
      .filter((l) => l.accountId && (parseRp(l.debit) > 0 || parseRp(l.credit) > 0))
      .map((l) => ({ accountId: Number(l.accountId), debit: parseRp(l.debit), credit: parseRp(l.credit), description: l.description || null }));
    setSaving(true);
    try {
      const res = await fetch("/api/accounting/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, memo, sourceType, lines: payload }) });
      if (!res.ok) return toast.error((await res.json()).error ?? "Gagal menyimpan jurnal.");
      toast.success("Jurnal tersimpan.");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Jurnal Manual / Saldo Awal</DialogTitle>
          <DialogDescription>Total debit harus sama dgn total kredit. Untuk saldo awal: pilih jenis &quot;Saldo Awal&quot; & tanggal mulai buku.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>Tanggal</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
            </div>
            <div className="grid gap-1.5">
              <Label>Jenis</Label>
              <Select value={sourceType} onValueChange={(v) => setSourceType(v ?? "MANUAL")}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue>{() => (sourceType === "OPENING_BALANCE" ? "Saldo Awal" : "Manual")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="OPENING_BALANCE">Saldo Awal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5 sm:col-span-3">
              <Label>Keterangan</Label>
              <Input value={memo} onChange={(e) => setMemo(e.target.value)} className="h-10" placeholder="mis. Saldo awal per 1 Oktober 2026" />
            </div>
          </div>
          <div className="grid gap-2">
            {lines.map((l, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_8rem_8rem_auto] items-start rounded-md border p-2">
                <Select value={l.accountId} onValueChange={(v) => patch(i, { accountId: v ?? "" })}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue>{() => accLabel(l.accountId)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.code} - {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input inputMode="numeric" placeholder="Debit" value={l.debit ? parseRp(l.debit).toLocaleString("id-ID") : ""} onChange={(e) => patch(i, { debit: String(parseRp(e.target.value)), credit: "" })} className="h-10 text-right tabular-nums" />
                <Input inputMode="numeric" placeholder="Kredit" value={l.credit ? parseRp(l.credit).toLocaleString("id-ID") : ""} onChange={(e) => patch(i, { credit: String(parseRp(e.target.value)), debit: "" })} className="h-10 text-right tabular-nums" />
                <Button type="button" variant="ghost" size="icon-sm" disabled={lines.length <= 2} onClick={() => setLines((c) => c.filter((_, idx) => idx !== i))} aria-label="Hapus baris">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" size="sm" onClick={() => setLines((c) => [...c, { accountId: "", debit: "", credit: "", description: "" }])}>+ Baris</Button>
              <p className={`text-sm tabular-nums ${balanced ? "text-emerald-700" : "text-red-600"}`}>
                Debit {fmtRp(totalDebit)} &middot; Kredit {fmtRp(totalCredit)}{!balanced && totalDebit + totalCredit > 0 && " (belum balance)"}
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={save} disabled={saving || !balanced}>{saving ? "Menyimpan..." : "Posting Jurnal"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Notes() {
  const [yearMonth, setYearMonth] = useState(thisMonth());
  const [content, setContent] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/accounting/notes?yearMonth=${yearMonth}`)
      .then((r) => r.json())
      .then((d) => {
        setContent(d.content ?? "");
        setUpdatedAt(d.updatedAt ?? null);
      });
  }, [yearMonth]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/accounting/notes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yearMonth, content }) });
      if (!res.ok) return toast.error("Gagal menyimpan catatan.");
      const d = await res.json();
      setUpdatedAt(d.updatedAt);
      toast.success("Catatan tersimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="min-w-0">
      <CardContent className="pt-6 grid gap-4">
        <div>
          <h2 className="font-heading font-semibold text-lg">Catatan atas Laporan Keuangan (CALK)</h2>
          <p className="text-sm text-muted-foreground">
            Penjelasan naratif per bulan - kebijakan akuntansi, kejadian penting, asumsi. Ditulis manual, menyertai P&amp;L/Neraca bulan itu.
          </p>
        </div>
        <div className="grid gap-1.5 w-full sm:w-48">
          <Label>Bulan</Label>
          <Input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} />
        </div>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={14} placeholder={"1. Dasar penyusunan...\n2. Kebijakan persediaan (FIFO dari Warehouse)...\n3. Kejadian penting bulan ini..."} />
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Catatan"}</Button>
          {updatedAt && <span className="text-xs text-muted-foreground">Terakhir disimpan {new Date(updatedAt).toLocaleString("id-ID")}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function Periods() {
  type Period = { yearMonth: string; entryCount: number; isLocked: boolean; lockedAt: string | null };
  const [periods, setPeriods] = useState<Period[] | null>(null);
  function load() {
    fetch("/api/accounting/periods").then((r) => r.json()).then(setPeriods);
  }
  useEffect(load, []);

  async function toggle(p: Period) {
    const lock = !p.isLocked;
    if (!confirm(lock ? `Kunci periode ${p.yearMonth}? Jurnal baru bertanggal di bulan ini akan ditolak & jurnal yang ada tidak bisa diubah/dihapus.` : `Buka kembali periode ${p.yearMonth}?`)) return;
    const res = await fetch("/api/accounting/periods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yearMonth: p.yearMonth, lock }) });
    if (!res.ok) return toast.error("Gagal mengubah status periode.");
    toast.success(lock ? `Periode ${p.yearMonth} dikunci.` : `Periode ${p.yearMonth} dibuka kembali.`);
    load();
  }

  return (
    <Card className="min-w-0">
      <CardContent className="pt-6 grid gap-4 min-w-0">
        <div>
          <h2 className="font-heading font-semibold text-lg">Kunci Periode</h2>
          <p className="text-sm text-muted-foreground">
            Setelah laporan bulan itu final, kunci periodenya supaya angka historis tidak berubah diam-diam (sync ulang, hapus, koreksi
            ditolak). Bisa dibuka lagi kalau memang perlu koreksi.
          </p>
        </div>
        {!periods && <p className="text-sm text-muted-foreground">Memuat...</p>}
        {periods && periods.length === 0 && <p className="text-sm text-muted-foreground">Belum ada jurnal.</p>}
        {periods && periods.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bulan</TableHead>
                <TableHead className="text-right">Jml Jurnal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((p) => (
                <TableRow key={p.yearMonth}>
                  <TableCell className="font-mono">{p.yearMonth}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.entryCount.toLocaleString("id-ID")}</TableCell>
                  <TableCell>
                    {p.isLocked ? (
                      <Badge variant="outline"><Lock className="h-3 w-3 mr-1" />Terkunci {p.lockedAt && `· ${fmtDate(p.lockedAt)}`}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Terbuka</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => toggle(p)}>
                      {p.isLocked ? <><Unlock className="h-3.5 w-3.5" /> Buka</> : <><Lock className="h-3.5 w-3.5" /> Kunci</>}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
