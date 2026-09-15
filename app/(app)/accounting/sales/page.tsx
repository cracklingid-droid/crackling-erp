"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RefreshCw, ShoppingCart } from "lucide-react";
import { SELLING_OUTLET_NAMES, OUTLET_ACCOUNTS } from "@/lib/accounting-outlets";

type SalesRecord = { id: number; date: string; outletName: string; total: number; source: string; journalEntryId: number | null };
type SalesResponse = {
  start: string;
  end: string;
  records: SalesRecord[];
  totals: { outletName: string; total: number; days: number }[];
  grandTotal: number;
  lastSyncedAt: string | null;
};

function fmtRp(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}
function isoDaysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function RecordSalesPage() {
  const [start, setStart] = useState(isoDaysAgo(29));
  const [end, setEnd] = useState(isoDaysAgo(0));
  const [outlet, setOutlet] = useState("");
  const [data, setData] = useState<SalesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ start, end });
    if (outlet) params.set("outlet", outlet);
    const res = await fetch(`/api/accounting/sales?${params}`);
    if (res.ok) setData(await res.json());
    else toast.error("Gagal memuat Record Sales.");
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/accounting/sales/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, end }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "Gagal sync.");
        return;
      }
      const parts = [`${d.created} hari baru`, `${d.updated} diperbarui`, `${d.unchanged} tidak berubah`];
      if (d.skippedReconciled) parts.push(`${d.skippedReconciled} dilewati (sudah direkonsiliasi)`);
      if (d.skippedLocked) parts.push(`${d.skippedLocked} dilewati (periode dikunci)`);
      toast.success(`Sync selesai: ${parts.join(", ")}.`);
      if (d.errors?.length) toast.error(`${d.errors.length} gagal: ${d.errors[0]}`);
      load();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="w-full grid gap-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Record Sales</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Omzet harian per outlet dari tab &quot;Daily&quot; sheet POS. Tiap hari otomatis dijurnal{" "}
          <span className="font-medium text-foreground">Dr AR - outlet / Cr Sales - outlet</span>; uang yang masuk ke bank
          dicocokkan di Rekonsiliasi (Dr Bank / Cr AR).
        </p>
      </div>

      <Card className="min-w-0">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-end">
            <div className="grid gap-1.5">
              <Label>Dari</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full sm:w-40" />
            </div>
            <div className="grid gap-1.5">
              <Label>Sampai</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full sm:w-40" />
            </div>
            <div className="grid gap-1.5">
              <Label>Outlet</Label>
              <Select value={outlet || "all"} onValueChange={(v) => setOutlet(v === "all" ? "" : v ?? "")}>
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue>{() => outlet || "Semua outlet"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua outlet</SelectItem>
                  {SELLING_OUTLET_NAMES.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={load} disabled={loading} className="w-full sm:w-fit">Lihat</Button>
            <Button variant="outline" onClick={sync} disabled={syncing} className="w-full sm:w-fit sm:ml-auto">
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Menyinkronkan..." : "Sync dari Sheet POS"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Sync menarik tanggal dlm rentang di atas (maks s/d hari ini). Hari yang totalnya tidak berubah dilewati - jurnal
            yang sudah direkonsiliasi tidak akan disentuh.
            {data?.lastSyncedAt && <> Sync terakhir: {new Date(data.lastSyncedAt).toLocaleString("id-ID")}.</>}
          </p>
        </CardContent>
      </Card>

      {data && (
        <div className="grid gap-3 sm:grid-cols-3">
          {data.totals.map((t) => (
            <div key={t.outletName} className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{OUTLET_ACCOUNTS[t.outletName]?.shortLabel ?? t.outletName}</p>
              <p className="text-xl font-heading font-semibold tabular-nums mt-1">{fmtRp(t.total)}</p>
              <p className="text-xs text-muted-foreground">{t.days} hari</p>
            </div>
          ))}
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-heading font-semibold tabular-nums mt-1">{fmtRp(data.grandTotal)}</p>
            <p className="text-xs text-muted-foreground">{data.records.length} baris</p>
          </div>
        </div>
      )}

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Omzet Harian ({data?.records.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}
          {!loading && data && data.records.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada data - klik &quot;Sync dari Sheet POS&quot; utk menarik omzet.</p>
          )}
          {!loading && data && data.records.length > 0 && (
            <div className="overflow-x-auto -mx-6 px-6 min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead className="text-right">Total Omzet</TableHead>
                    <TableHead>Jurnal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                      <TableCell className="whitespace-nowrap">{OUTLET_ACCOUNTS[r.outletName]?.shortLabel ?? r.outletName}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmtRp(r.total)}</TableCell>
                      <TableCell>
                        {r.journalEntryId ? (
                          <Badge variant="outline" className="font-mono">#{r.journalEntryId}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700">belum dijurnal</Badge>
                        )}
                      </TableCell>
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
