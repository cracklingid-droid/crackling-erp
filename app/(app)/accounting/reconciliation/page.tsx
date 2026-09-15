"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTab, TabsIndicator, TabsPanel } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Scale, Search, ChevronLeft, ChevronRight, ArrowLeft, Link2, Unlink, PlusCircle, X, Upload } from "lucide-react";
import { SELLING_OUTLET_NAMES, OUTLET_ACCOUNTS } from "@/lib/accounting-outlets";

type BankAccountSummary = {
  id: number;
  name: string;
  bankName: string | null;
  accountId: number;
  accountCode: string | null;
  lineCount: number;
  unreconciledCount: number;
  earliestDate: string | null;
  latestDate: string | null;
  latestBalance: number | null;
};
type StatementLine = {
  id: number;
  date: string;
  description: string;
  amount: number;
  balance: number | null;
  matchedJournalLineId: number | null;
  matchedJournal: { journalLineId: number; journalEntryId: number; memo: string; sourceType: string; date: string } | null;
};
type JournalRow = {
  id: number;
  journalEntryId: number;
  date: string;
  memo: string;
  sourceType: string;
  description: string | null;
  contactName: string | null;
  received: number;
  spent: number;
  isLocked: boolean;
  matchedStatementLine: { id: number; date: string; description: string; amount: number } | null;
};
type Account = { id: number; code: string; name: string; type: string; isActive: boolean };

const SOURCE_LABEL: Record<string, string> = {
  RECORD_SALES: "Record Sales",
  BANK_TRANSFER: "Transfer Bank",
  COGS_SYNC: "HPP",
  DIRECT_EXPENSE: "Direct Expense",
  DEPRECIATION: "Penyusutan",
  BANK_ADJUSTMENT: "Jurnal Bank",
  AR_RECEIPT: "Penerimaan Penjualan",
  OPENING_BALANCE: "Saldo Awal",
  FIXED_ASSET_ACQUISITION: "Perolehan Aset",
  MANUAL: "Manual",
};

function fmtRp(n: number | null): string {
  if (n === null) return "-";
  return (n < 0 ? "-Rp" : "Rp") + Math.abs(n).toLocaleString("id-ID");
}
function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}
async function friendlyError(res: Response) {
  try {
    return (await res.json()).error ?? "Terjadi kesalahan.";
  } catch {
    return "Terjadi kesalahan.";
  }
}

export default function ReconciliationPage() {
  const [accounts, setAccounts] = useState<BankAccountSummary[] | null>(null);
  const [selected, setSelected] = useState<BankAccountSummary | null>(null);

  function load() {
    fetch("/api/accounting/bank-accounts")
      .then((r) => r.json())
      .then((data: BankAccountSummary[]) => {
        setAccounts(data);
        if (selected) setSelected(data.find((a) => a.id === selected.id) ?? null);
      });
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (selected) return <BankAccountDetail account={selected} onBack={() => setSelected(null)} onChanged={load} />;

  const totalLines = accounts?.reduce((s, a) => s + a.lineCount, 0) ?? 0;
  const totalUnrec = accounts?.reduce((s, a) => s + a.unreconciledCount, 0) ?? 0;

  return (
    <div className="max-w-5xl grid gap-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Rekonsiliasi Bank</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {totalLines.toLocaleString("id-ID")} mutasi dari rekening koran, {totalUnrec.toLocaleString("id-ID")} belum dicocokkan. Tiap akun
          punya 3 tab: Jurnal (transaksi tercatat), Mutasi Bank, dan Rekonsiliasi (pencocokan). Transaksi yang sudah recon tidak
          bisa dihapus sebelum di-unrecon.
        </p>
      </div>

      <TransferSuggestions onRecorded={load} />

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-4 w-4" /> Akun Bank ({accounts?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          {!accounts && <p className="text-sm text-muted-foreground">Memuat...</p>}
          {accounts && (
            <div className="overflow-x-auto -mx-6 px-6 min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Akun</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead className="text-right">Mutasi</TableHead>
                    <TableHead className="text-right">Belum Recon</TableHead>
                    <TableHead>Rentang</TableHead>
                    <TableHead className="text-right">Saldo Terakhir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((a) => (
                    <TableRow key={a.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(a)}>
                      <TableCell className="font-medium whitespace-normal min-w-56">
                        {a.name}
                        {a.accountCode && <span className="ml-2 font-mono text-xs text-muted-foreground">{a.accountCode}</span>}
                      </TableCell>
                      <TableCell>{a.bankName ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.lineCount.toLocaleString("id-ID")}</TableCell>
                      <TableCell className="text-right">
                        {a.unreconciledCount > 0 ? (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 tabular-nums">{a.unreconciledCount.toLocaleString("id-ID")}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-700 border-emerald-300">0</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {a.lineCount === 0 ? "-" : `${fmtDate(a.earliestDate)} - ${fmtDate(a.latestDate)}`}
                      </TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">{fmtRp(a.latestBalance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Rekomendasi transfer antar bank / top-up petty cash (permintaan Kevin
// 2026-09-15): pasangan mutasi keluar-masuk dgn nominal sama di 2 akun
// berbeda, selisih <= 3 hari. Sekali klik -> 1 jurnal transfer (Dr bank
// tujuan / Cr bank asal) & kedua mutasi langsung reconciled.
type Suggestion = {
  fromLineId: number;
  toLineId: number;
  amount: number;
  date: string;
  dayDiff: number;
  confidence: "tinggi" | "sedang" | "rendah";
  from: { bankAccountId: number; bankName: string; date: string; description: string };
  to: { bankAccountId: number; bankName: string; date: string; description: string };
};

function TransferSuggestions({ onRecorded, bankAccountId }: { onRecorded: () => void; bankAccountId?: number }) {
  const [data, setData] = useState<{ total: number; suggestions: Suggestion[] } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [minConf, setMinConf] = useState<"tinggi" | "sedang" | "rendah">("sedang");

  function load() {
    const params = new URLSearchParams({ limit: "300" });
    if (bankAccountId) params.set("bankAccountId", String(bankAccountId));
    fetch(`/api/accounting/reconciliation/suggestions?${params}`)
      .then((r) => r.json())
      .then(setData);
  }
  useEffect(load, [bankAccountId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function record(s: Suggestion) {
    setBusy(s.fromLineId);
    try {
      const res = await fetch("/api/accounting/reconciliation/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromLineId: s.fromLineId, toLineId: s.toLineId }),
      });
      if (!res.ok) return toast.error(await friendlyError(res));
      toast.success(`Transfer ${fmtRp(s.amount)} dicatat & kedua mutasi reconciled.`);
      load();
      onRecorded();
    } finally {
      setBusy(null);
    }
  }

  const rank = { tinggi: 3, sedang: 2, rendah: 1 };
  const shown = (data?.suggestions ?? []).filter((s) => rank[s.confidence] >= rank[minConf]);
  const visible = expanded ? shown : shown.slice(0, 8);

  return (
    <Card className="min-w-0 border-primary/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <Link2 className="h-4 w-4" /> Rekomendasi transfer antar bank / top-up petty cash
          {data && <Badge variant="outline" className="tabular-nums">{shown.length}</Badge>}
          <div className="ml-auto flex items-center gap-2 text-xs font-normal">
            <span className="text-muted-foreground">Keyakinan min.</span>
            <Select value={minConf} onValueChange={(v) => setMinConf((v as typeof minConf) ?? "sedang")}>
              <SelectTrigger className="h-8 w-28">
                <SelectValue>{() => ({ tinggi: "Tinggi", sedang: "Sedang", rendah: "Semua" })[minConf]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tinggi">Tinggi</SelectItem>
                <SelectItem value="sedang">Sedang</SelectItem>
                <SelectItem value="rendah">Semua</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 grid gap-3">
        <p className="text-xs text-muted-foreground">
          Pasangan mutasi keluar &amp; masuk dgn nominal sama di dua akun berbeda (selisih maks 3 hari). Klik &quot;Catat transfer&quot; -&gt; 1 jurnal
          Dr bank tujuan / Cr bank asal, kedua mutasi langsung reconciled. Ini saran - cek keterangannya dulu.
        </p>
        {!data && <p className="text-sm text-muted-foreground">Mencari pasangan...</p>}
        {data && shown.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada rekomendasi dgn tingkat keyakinan ini.</p>}
        {visible.length > 0 && (
          <div className="overflow-x-auto -mx-6 px-6 min-w-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Dari (keluar)</TableHead>
                  <TableHead>Ke (masuk)</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead>Keyakinan</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((s) => (
                  <TableRow key={`${s.fromLineId}-${s.toLineId}`}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {fmtDate(s.from.date)}
                      {s.dayDiff > 0 && <span className="block text-[11px] text-muted-foreground">masuk {fmtDate(s.to.date)}</span>}
                    </TableCell>
                    <TableCell className="whitespace-normal min-w-56 text-sm">
                      <p className="font-medium">{s.from.bankName}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{s.from.description}</p>
                    </TableCell>
                    <TableCell className="whitespace-normal min-w-56 text-sm">
                      <p className="font-medium">{s.to.bankName}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{s.to.description}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap font-medium">{fmtRp(s.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={s.confidence === "tinggi" ? "text-emerald-700 border-emerald-300" : s.confidence === "sedang" ? "text-amber-700 border-amber-300" : "text-muted-foreground"}>
                        {s.confidence}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button size="sm" variant="outline" disabled={busy === s.fromLineId} onClick={() => record(s)}>
                        <Link2 className="h-3.5 w-3.5" /> Catat transfer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {shown.length > 8 && (
          <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setExpanded((e) => !e)}>
            {expanded ? "Tampilkan lebih sedikit" : `Tampilkan semua (${shown.length})`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">Halaman {page} dari {totalPages}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Berikutnya <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function BankAccountDetail({ account, onBack, onChanged }: { account: BankAccountSummary; onBack: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState("recon");
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => {
    setRefreshKey((k) => k + 1);
    onChanged();
  };

  return (
    <div className="max-w-6xl grid gap-6">
      <div>
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Daftar Akun Bank
        </button>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">
          {account.accountCode && <span className="font-mono text-muted-foreground text-lg mr-2">({account.accountCode})</span>}
          {account.name}
        </h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {account.bankName} &middot; {account.lineCount.toLocaleString("id-ID")} mutasi &middot; saldo terakhir {fmtRp(account.latestBalance)}
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList>
          <TabsIndicator />
          <TabsTab value="journal">Jurnal</TabsTab>
          <TabsTab value="statement">Mutasi Bank</TabsTab>
          <TabsTab value="recon">
            Rekonsiliasi
            {account.unreconciledCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-100 text-amber-800 px-1.5 text-xs tabular-nums">{account.unreconciledCount}</span>
            )}
          </TabsTab>
        </TabsList>
        <TabsPanel value="journal">
          <JournalTab account={account} refreshKey={refreshKey} />
        </TabsPanel>
        <TabsPanel value="statement">
          <StatementTab account={account} refreshKey={refreshKey} onChanged={bump} />
        </TabsPanel>
        <TabsPanel value="recon">
          <ReconTab account={account} refreshKey={refreshKey} onChanged={bump} />
        </TabsPanel>
      </Tabs>
    </div>
  );
}

function JournalTab({ account, refreshKey }: { account: BankAccountSummary; refreshKey: number }) {
  const [rows, setRows] = useState<JournalRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    setRows(null);
    const params = new URLSearchParams({ page: String(page), status });
    if (search.trim()) params.set("search", search.trim());
    fetch(`/api/accounting/bank-accounts/${account.id}/journal?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.lines);
        setTotal(d.total);
      });
  }, [account.id, page, search, status, refreshKey]);

  return (
    <Card className="min-w-0">
      <CardContent className="pt-6 grid gap-4 min-w-0">
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={status} onValueChange={(v) => { setStatus(v ?? "all"); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue>{() => ({ all: "Semua status", matched: "Reconciled", unmatched: "Belum recon" })[status]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="matched">Reconciled</SelectItem>
              <SelectItem value="unmatched">Belum recon</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Cari transaksi jurnal..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <span className="text-sm text-muted-foreground sm:ml-auto self-center">{total.toLocaleString("id-ID")} transaksi</span>
        </div>
        {!rows && <p className="text-sm text-muted-foreground">Memuat...</p>}
        {rows && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Belum ada transaksi jurnal yang menyentuh akun bank ini. Catat lewat tab Rekonsiliasi (dari mutasi) atau modul lain.</p>
        )}
        {rows && rows.length > 0 && (
          <div className="overflow-x-auto -mx-6 px-6 min-w-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Transaksi</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm">{fmtDate(r.date)}</TableCell>
                    <TableCell className="whitespace-normal min-w-64">
                      <p className="text-sm font-medium">
                        <Badge variant="outline" className="mr-1.5 font-normal">{SOURCE_LABEL[r.sourceType] ?? r.sourceType}</Badge>
                        <span className="font-mono text-xs text-muted-foreground">#{r.journalEntryId}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">{r.memo}{r.contactName ? ` · ${r.contactName}` : ""}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap text-emerald-600 dark:text-emerald-400">{r.received ? fmtRp(r.received) : "-"}</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap text-red-600 dark:text-red-400">{r.spent ? fmtRp(r.spent) : "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.matchedStatementLine ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400" title={`Mutasi ${fmtDate(r.matchedStatementLine.date)}: ${r.matchedStatementLine.description}`}>
                          Reconciled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-700 border-amber-300">Belum</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Pager page={page} total={total} pageSize={50} onPage={setPage} />
      </CardContent>
    </Card>
  );
}

function StatementTab({ account, refreshKey, onChanged }: { account: BankAccountSummary; refreshKey: number; onChanged: () => void }) {
  const [lines, setLines] = useState<StatementLine[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    setLines(null);
    const params = new URLSearchParams({ page: String(page), status });
    if (search.trim()) params.set("search", search.trim());
    fetch(`/api/accounting/bank-accounts/${account.id}/lines?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setLines(d.lines);
        setTotal(d.total);
      });
  }, [account.id, page, search, status, refreshKey]);

  async function unrecon(l: StatementLine) {
    if (!confirm("Lepas pencocokan (unrecon) mutasi ini? Transaksi jurnalnya tetap ada, cuma statusnya jadi belum recon.")) return;
    const res = await fetch("/api/accounting/reconciliation/match", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statementLineId: l.id }) });
    if (!res.ok) return toast.error(await friendlyError(res));
    toast.success("Unrecon berhasil.");
    onChanged();
  }

  return (
    <Card className="min-w-0">
      <CardContent className="pt-6 grid gap-4 min-w-0">
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={status} onValueChange={(v) => { setStatus(v ?? "all"); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue>{() => ({ all: "Semua status", matched: "Reconciled", unmatched: "Belum recon" })[status]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="matched">Reconciled</SelectItem>
              <SelectItem value="unmatched">Belum recon</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Cari keterangan mutasi..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <span className="text-sm text-muted-foreground sm:ml-auto self-center">{total.toLocaleString("id-ID")} mutasi</span>
          <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
            <Upload className="h-3.5 w-3.5" /> Upload Mutasi
          </Button>
          {uploadOpen && <UploadStatementDialog account={account} onClose={() => setUploadOpen(false)} onDone={() => { setUploadOpen(false); onChanged(); }} />}
        </div>
        {!lines && <p className="text-sm text-muted-foreground">Memuat...</p>}
        {lines && lines.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada mutasi yang cocok.</p>}
        {lines && lines.length > 0 && (
          <div className="overflow-x-auto -mx-6 px-6 min-w-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-sm">{fmtDate(l.date)}</TableCell>
                    <TableCell className="whitespace-normal min-w-64 text-sm text-muted-foreground">{l.description}</TableCell>
                    <TableCell className={`text-right tabular-nums whitespace-nowrap ${l.amount < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{fmtRp(l.amount)}</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">{fmtRp(l.balance)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {l.matchedJournal ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400" title={l.matchedJournal.memo}>
                          Reconciled #{l.matchedJournal.journalEntryId}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-700 border-amber-300">Belum</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {l.matchedJournal && (
                        <Button variant="ghost" size="sm" onClick={() => unrecon(l)} title="Unrecon">
                          <Unlink className="h-3.5 w-3.5" /> Unrecon
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Pager page={page} total={total} pageSize={50} onPage={setPage} />
      </CardContent>
    </Card>
  );
}

// Upload mutasi bank (CSV/XLSX) - 2 langkah: preview (deteksi kolom, tanda
// duplikat) lalu impor. Permintaan Kevin 2026-09-15.
function UploadStatementDialog({ account, onClose, onDone }: { account: BankAccountSummary; onClose: () => void; onDone: () => void }) {
  type PreviewRow = { date: string; description: string; amount: number; balance: number | null; duplicate: boolean };
  type Preview = { headers: string[]; mapping: Record<string, string | undefined>; total: number; skipped: number; duplicates: number; rows: PreviewRow[] };
  const [file, setFile] = useState<File | null>(null);
  const [dateFormat, setDateFormat] = useState<"auto" | "dmy" | "mdy">("auto");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [headersOnly, setHeadersOnly] = useState<string[] | null>(null);
  const [manual, setManual] = useState<{ date: string; description: string; amount: string; credit: string; debit: string; balance: string }>({ date: "", description: "", amount: "", credit: "", debit: "", balance: "" });

  async function runPreview(withManual: boolean) {
    if (!file) return toast.error("Pilih file dulu.");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("dateFormat", dateFormat);
      if (withManual) {
        const m: Record<string, string> = {};
        for (const [k, v] of Object.entries(manual)) if (v) m[k] = v;
        form.append("mapping", JSON.stringify(m));
      }
      const res = await fetch(`/api/accounting/bank-accounts/${account.id}/import`, { method: "POST", body: form });
      const d = await res.json();
      if (res.status === 422 && d.headers) {
        setHeadersOnly(d.headers);
        setPreview(null);
        return toast.error(d.error);
      }
      if (!res.ok) return toast.error(d.error ?? "Gagal membaca file.");
      setHeadersOnly(null);
      setPreview(d);
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setBusy(true);
    try {
      const rows = preview.rows.filter((r) => !r.duplicate).map(({ date, description, amount, balance }) => ({ date, description, amount, balance }));
      const res = await fetch(`/api/accounting/bank-accounts/${account.id}/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
      const d = await res.json();
      if (!res.ok) return toast.error(d.error ?? "Gagal mengimpor.");
      const dupes = (preview.duplicates ?? 0) + (d.skippedDuplicates ?? 0);
      toast.success(`${d.inserted} mutasi diimpor${dupes ? `, ${dupes} duplikat dilewati` : ""}.`);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  const colSelect = (key: keyof typeof manual, label: string) => (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      <Select value={manual[key] || "none"} onValueChange={(v) => setManual((m) => ({ ...m, [key]: v === "none" ? "" : v ?? "" }))}>
        <SelectTrigger className="h-9 w-full">
          <SelectValue>{() => manual[key] || "-"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">-</SelectItem>
          {(headersOnly ?? []).map((h) => (
            <SelectItem key={h} value={h}>{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Mutasi - {account.name}</DialogTitle>
          <DialogDescription>
            CSV atau Excel (.xlsx) export bank / sheet mutasi. Kolom tanggal, keterangan, nominal (atau kredit/debit terpisah) &amp; saldo dideteksi otomatis. Baris yang sudah ada (tanggal + nominal + keterangan sama) dilewati.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_12rem_auto] items-end">
            <div className="grid gap-1.5">
              <Label>File</Label>
              <Input type="file" accept=".csv,.xlsx,.xlsm,text/csv" className="h-10" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setHeadersOnly(null); }} />
            </div>
            <div className="grid gap-1.5">
              <Label>Format tanggal</Label>
              <Select value={dateFormat} onValueChange={(v) => setDateFormat((v as typeof dateFormat) ?? "auto")}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue>{() => ({ auto: "Otomatis", dmy: "DD/MM/YYYY", mdy: "MM/DD/YYYY" })[dateFormat]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Otomatis</SelectItem>
                  <SelectItem value="dmy">DD/MM/YYYY (Indonesia)</SelectItem>
                  <SelectItem value="mdy">MM/DD/YYYY (AS)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => runPreview(false)} disabled={!file || busy} className="h-10">{busy ? "Membaca..." : "Baca & Preview"}</Button>
          </div>

          {headersOnly && (
            <div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 grid gap-2 dark:bg-amber-950/20">
              <p className="text-sm">Kolom tidak terdeteksi otomatis - pilih manual dari header file:</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {colSelect("date", "Tanggal")}
                {colSelect("description", "Keterangan")}
                {colSelect("amount", "Nominal (+/-)")}
                {colSelect("credit", "Kredit / masuk")}
                {colSelect("debit", "Debit / keluar")}
                {colSelect("balance", "Saldo (opsional)")}
              </div>
              <Button size="sm" onClick={() => runPreview(true)} disabled={busy} className="justify-self-start">Baca ulang dgn kolom ini</Button>
            </div>
          )}

          {preview && (
            <>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="outline">{preview.total} baris terbaca</Badge>
                {preview.duplicates > 0 && <Badge variant="outline" className="text-amber-700 border-amber-300">{preview.duplicates} duplikat (dilewati)</Badge>}
                {preview.skipped > 0 && <Badge variant="outline" className="text-muted-foreground">{preview.skipped} baris tanpa tanggal/nominal diabaikan</Badge>}
                <span className="text-xs text-muted-foreground self-center">
                  Kolom: tanggal={preview.mapping.date}, keterangan={preview.mapping.description}, {preview.mapping.amount ? `nominal=${preview.mapping.amount}` : `kredit=${preview.mapping.credit ?? "-"}, debit=${preview.mapping.debit ?? "-"}`}
                  {preview.mapping.balance && `, saldo=${preview.mapping.balance}`}
                </span>
              </div>
              <div className="overflow-x-auto -mx-4 px-4 min-w-0 max-h-72 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.slice(0, 200).map((r, i) => (
                      <TableRow key={i} className={r.duplicate ? "opacity-50" : ""}>
                        <TableCell className="whitespace-nowrap text-sm">{fmtDate(r.date)}</TableCell>
                        <TableCell className="whitespace-normal min-w-56 text-xs text-muted-foreground">{r.description}</TableCell>
                        <TableCell className={`text-right tabular-nums whitespace-nowrap text-sm ${r.amount < 0 ? "text-red-600" : "text-emerald-600"}`}>{fmtRp(r.amount)}</TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap text-sm">{fmtRp(r.balance)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{r.duplicate ? "duplikat" : ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {preview.rows.length > 200 && <p className="text-xs text-muted-foreground p-2">Menampilkan 200 dari {preview.rows.length} baris.</p>}
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={confirmImport} disabled={!preview || busy || preview.total - preview.duplicates === 0}>
            {busy ? "Mengimpor..." : `Impor ${preview ? preview.total - preview.duplicates : 0} mutasi`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReconTab({ account, refreshKey, onChanged }: { account: BankAccountSummary; refreshKey: number; onChanged: () => void }) {
  const [lines, setLines] = useState<StatementLine[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [matchTarget, setMatchTarget] = useState<StatementLine | null>(null);
  const [recordTarget, setRecordTarget] = useState<StatementLine | null>(null);

  useEffect(() => {
    setLines(null);
    const params = new URLSearchParams({ page: String(page), status: "unmatched" });
    if (search.trim()) params.set("search", search.trim());
    fetch(`/api/accounting/bank-accounts/${account.id}/lines?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setLines(d.lines);
        setTotal(d.total);
      });
  }, [account.id, page, search, refreshKey]);

  return (
    <div className="grid gap-4">
    <TransferSuggestions bankAccountId={account.id} onRecorded={onChanged} />
    <Card className="min-w-0">
      <CardContent className="pt-6 grid gap-4 min-w-0">
        <p className="text-sm text-muted-foreground">
          Mutasi bank yang <span className="font-medium text-foreground">belum tercatat/dicocokkan</span>. Untuk tiap baris: <span className="font-medium text-foreground">Cocokkan</span> ke transaksi
          jurnal yang sudah ada (nominal harus sama), atau <span className="font-medium text-foreground">Catat</span> transaksi baru langsung dari mutasi ini (beban, penerimaan
          penjualan, atau jurnal umum/transfer).
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Cari keterangan mutasi..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <span className="text-sm text-muted-foreground sm:ml-auto self-center">{total.toLocaleString("id-ID")} belum recon</span>
        </div>
        {!lines && <p className="text-sm text-muted-foreground">Memuat...</p>}
        {lines && lines.length === 0 && <p className="text-sm text-emerald-700">Semua mutasi akun ini sudah dicocokkan.</p>}
        {lines && lines.length > 0 && (
          <div className="overflow-x-auto -mx-6 px-6 min-w-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-sm">{fmtDate(l.date)}</TableCell>
                    <TableCell className="whitespace-normal min-w-64 text-sm text-muted-foreground">{l.description}</TableCell>
                    <TableCell className={`text-right tabular-nums whitespace-nowrap ${l.amount < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{fmtRp(l.amount)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="outline" size="sm" onClick={() => setMatchTarget(l)}>
                        <Link2 className="h-3.5 w-3.5" /> Cocokkan
                      </Button>
                      <Button variant="outline" size="sm" className="ml-1.5" onClick={() => setRecordTarget(l)}>
                        <PlusCircle className="h-3.5 w-3.5" /> Catat
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Pager page={page} total={total} pageSize={50} onPage={setPage} />
      </CardContent>

      {matchTarget && (
        <MatchDialog account={account} line={matchTarget} onClose={() => setMatchTarget(null)} onDone={() => { setMatchTarget(null); onChanged(); }} />
      )}
      {recordTarget && (
        <RecordDialog account={account} line={recordTarget} onClose={() => setRecordTarget(null)} onDone={() => { setRecordTarget(null); onChanged(); }} />
      )}
    </Card>
    </div>
  );
}

// Pilih baris jurnal (belum recon, akun bank sama, nominal sama persis) utk
// dipasangkan ke 1 mutasi.
function MatchDialog({ account, line, onClose, onDone }: { account: BankAccountSummary; line: StatementLine; onClose: () => void; onDone: () => void }) {
  const [candidates, setCandidates] = useState<JournalRow[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/accounting/bank-accounts/${account.id}/journal?status=unmatched&page=1`)
      .then((r) => r.json())
      .then((d) => setCandidates((d.lines as JournalRow[]).filter((j) => j.received - j.spent === line.amount)));
  }, [account.id, line.amount]);

  async function pick(j: JournalRow) {
    setSaving(true);
    try {
      const res = await fetch("/api/accounting/reconciliation/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statementLineId: line.id, journalLineId: j.id }),
      });
      if (!res.ok) return toast.error(await friendlyError(res));
      toast.success("Dicocokkan (reconciled).");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cocokkan mutasi {fmtRp(line.amount)}</DialogTitle>
          <DialogDescription>
            {fmtDate(line.date)} &middot; {line.description}
          </DialogDescription>
        </DialogHeader>
        {!candidates && <p className="text-sm text-muted-foreground">Mencari transaksi jurnal dgn nominal sama...</p>}
        {candidates && candidates.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Tidak ada transaksi jurnal belum-recon di akun ini dgn nominal {fmtRp(line.amount)}. Pakai &quot;Catat&quot; utk membuat transaksinya dari mutasi ini.
          </p>
        )}
        {candidates && candidates.length > 0 && (
          <div className="grid gap-2 max-h-80 overflow-y-auto">
            {candidates.map((j) => (
              <button
                key={j.id}
                type="button"
                disabled={saving}
                onClick={() => pick(j)}
                className="text-left rounded-md border p-3 hover:bg-accent transition-colors"
              >
                <p className="text-sm font-medium">
                  <Badge variant="outline" className="mr-1.5 font-normal">{SOURCE_LABEL[j.sourceType] ?? j.sourceType}</Badge>
                  {fmtDate(j.date)} &middot; <span className="font-mono text-xs text-muted-foreground">#{j.journalEntryId}</span>
                </p>
                <p className="text-sm text-muted-foreground">{j.memo}</p>
              </button>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Catat transaksi baru langsung dari 1 mutasi (nominal & tanggal ikut
// mutasi), otomatis reconciled - pola "Create transaction" Jurnal.id.
function RecordDialog({ account, line, onClose, onDone }: { account: BankAccountSummary; line: StatementLine; onClose: () => void; onDone: () => void }) {
  const isInflow = line.amount > 0;
  const amount = Math.abs(line.amount);
  const [mode, setMode] = useState(isInflow ? "ar_receipt" : "expense");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<{ id: number; name: string }[]>([]);
  const [description, setDescription] = useState("");
  const [outletName, setOutletName] = useState("");
  const [contactId, setContactId] = useState("");
  const [counterAccountId, setCounterAccountId] = useState("");
  const [lines, setLines] = useState<{ description: string; amount: string; accountId: string }[]>([{ description: "", amount: String(amount), accountId: "" }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/accounting/coa").then((r) => r.json()).then(setAccounts);
    fetch("/api/accounting/contacts").then((r) => r.json()).then(setContacts);
  }, []);

  const expenseAccounts = accounts.filter((a) => a.type === "EXPENSE" && a.isActive && !a.code.endsWith("-0000"));
  const counterAccounts = accounts.filter((a) => a.isActive && a.id !== account.accountId && !a.code.endsWith("-0000"));
  const accountLabel = (id: string) => {
    const a = accounts.find((x) => String(x.id) === id);
    return a ? `${a.code} - ${a.name}` : "";
  };
  const parseRp = (s: string) => Number(s.replace(/\D/g, "")) || 0;
  const linesTotal = lines.reduce((s, l) => s + parseRp(l.amount), 0);

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { statementLineId: line.id, mode, description: description || null, outletName: outletName || null, contactId: contactId ? Number(contactId) : null };
      if (mode === "expense") payload.lines = lines.map((l) => ({ description: l.description, amount: parseRp(l.amount), accountId: Number(l.accountId) || null }));
      if (mode === "journal") payload.counterAccountId = Number(counterAccountId) || null;
      const res = await fetch("/api/accounting/reconciliation/record", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) return toast.error(await friendlyError(res));
      toast.success("Transaksi dicatat & langsung reconciled.");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Catat transaksi dari mutasi {fmtRp(line.amount)}</DialogTitle>
          <DialogDescription>
            {fmtDate(line.date)} &middot; {line.description}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Jenis</Label>
            <Select value={mode} onValueChange={(v) => setMode(v ?? mode)}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue>{() => ({ expense: "Beban (Direct Expense)", ar_receipt: "Penerimaan penjualan (pelunasan AR outlet)", journal: "Jurnal umum / transfer (pilih akun lawan)" })[mode]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {!isInflow && <SelectItem value="expense">Beban (Direct Expense)</SelectItem>}
                {isInflow && <SelectItem value="ar_receipt">Penerimaan penjualan (pelunasan AR outlet)</SelectItem>}
                <SelectItem value="journal">Jurnal umum / transfer (pilih akun lawan)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "ar_receipt" && (
            <div className="grid gap-1.5">
              <Label>Outlet penjualan</Label>
              <Select value={outletName} onValueChange={(v) => setOutletName(v ?? "")}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue>{() => (outletName ? OUTLET_ACCOUNTS[outletName]?.shortLabel ?? outletName : "Pilih outlet...")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SELLING_OUTLET_NAMES.map((o) => (
                    <SelectItem key={o} value={o}>{OUTLET_ACCOUNTS[o].shortLabel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Jurnal: Dr {account.name} / Cr AR - outlet, {fmtRp(amount)}.</p>
            </div>
          )}

          {mode === "journal" && (
            <div className="grid gap-1.5">
              <Label>Akun lawan</Label>
              <Select value={counterAccountId} onValueChange={(v) => setCounterAccountId(v ?? "")}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue>{() => accountLabel(counterAccountId) || "Pilih akun..."}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {counterAccounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.code} - {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isInflow ? `Dr ${account.name} / Cr akun lawan` : `Dr akun lawan / Cr ${account.name}`}, {fmtRp(amount)}. Transfer antar bank: pilih akun bank tujuan/asal sbg akun lawan.
              </p>
            </div>
          )}

          {mode === "expense" && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Rincian beban (total harus {fmtRp(amount)})</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setLines((c) => [...c, { description: "", amount: "", accountId: "" }])}>+ Baris</Button>
              </div>
              {lines.map((l, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_8rem_1fr_auto] items-start rounded-md border p-2">
                  <Input placeholder="Keterangan" value={l.description} onChange={(e) => setLines((c) => c.map((x, idx) => (idx === i ? { ...x, description: e.target.value } : x)))} className="h-10" />
                  <Input inputMode="numeric" value={l.amount ? parseRp(l.amount).toLocaleString("id-ID") : ""} onChange={(e) => setLines((c) => c.map((x, idx) => (idx === i ? { ...x, amount: String(parseRp(e.target.value)) } : x)))} className="h-10 text-right tabular-nums" />
                  <Select value={l.accountId} onValueChange={(v) => setLines((c) => c.map((x, idx) => (idx === i ? { ...x, accountId: v ?? "" } : x)))}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue>{() => accountLabel(l.accountId) || "Akun beban..."}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {expenseAccounts.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.code} - {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon-sm" disabled={lines.length === 1} onClick={() => setLines((c) => c.filter((_, idx) => idx !== i))} aria-label="Hapus baris">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <p className={`text-sm text-right ${linesTotal === amount ? "text-muted-foreground" : "text-red-600"}`}>
                Total baris: <span className="font-semibold tabular-nums">{fmtRp(linesTotal)}</span>{linesTotal !== amount && ` (selisih ${fmtRp(amount - linesTotal)})`}
              </p>
              <div className="grid gap-1.5">
                <Label>Vendor (opsional)</Label>
                <Select value={contactId || "none"} onValueChange={(v) => setContactId(v === "none" ? "" : v ?? "")}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue>{() => contacts.find((c) => String(c.id) === contactId)?.name ?? "Tanpa vendor"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa vendor</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Keterangan (opsional, default = keterangan mutasi)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-10" placeholder={line.description} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={save} disabled={saving || (mode === "expense" && linesTotal !== amount)}>{saving ? "Menyimpan..." : "Catat & Reconcile"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
