"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RefreshCw, Boxes } from "lucide-react";

type Row = { id: number; date: string; outletName: string | null; amount: number; isLocked: boolean };
type CogsResponse = { start: string; end: string; rows: Row[]; totals: { outletName: string; total: number; days: number }[]; grandTotal: number };

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

export default function CogsPage() {
  const [start, setStart] = useState(isoDaysAgo(29));
  const [end, setEnd] = useState(isoDaysAgo(0));
  const [data, setData] = useState<CogsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/accounting/cogs?${new URLSearchParams({ start, end })}`);
    if (res.ok) setData(await res.json());
    else toast.error("Gagal memuat HPP.");
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/accounting/cogs/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, end }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "Gagal sync.");
        return;
      }
      const parts = [`${d.created} baru`, `${d.updated} diperbarui`, `${d.unchanged} tidak berubah`];
      if (d.skippedLocked) parts.push(`${d.skippedLocked} dilewati (periode dikunci)`);
      toast.success(`Sync HPP selesai (${d.totalRows} outlet-hari): ${parts.join(", ")}.`);
      if (d.errors?.length) toast.error(`${d.errors.length} gagal: ${d.errors[0]}`);
      load();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="w-full grid gap-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">COGS (HPP)</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Beban pokok penjualan otomatis dari pemakaian stok Warehouse (FIFO) - angka yang sama dgn &quot;Biaya Pemakaian&quot; di
          Cost Center. Tiap outlet-hari dijurnal <span className="font-medium text-foreground">Dr Beban Pokok Penjualan / Cr Persediaan</span>.
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
            <Button onClick={load} disabled={loading} className="w-full sm:w-fit">Lihat</Button>
            <Button variant="outline" onClick={sync} disabled={syncing} className="w-full sm:w-fit sm:ml-auto">
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Menyinkronkan..." : "Sync HPP dari Warehouse"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Sync membaca ulang pemakaian stok Warehouse utk rentang di atas. Hari yang nilainya tidak berubah dilewati.
          </p>
        </CardContent>
      </Card>

      {data && (
        <div className="grid gap-3 sm:grid-cols-4">
          {data.totals.map((t) => (
            <div key={t.outletName} className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{t.outletName}</p>
              <p className="text-xl font-heading font-semibold tabular-nums mt-1">{fmtRp(t.total)}</p>
              <p className="text-xs text-muted-foreground">{t.days} hari</p>
            </div>
          ))}
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">Total HPP</p>
            <p className="text-xl font-heading font-semibold tabular-nums mt-1">{fmtRp(data.grandTotal)}</p>
          </div>
        </div>
      )}

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Boxes className="h-4 w-4" /> Jurnal HPP ({data?.rows.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}
          {!loading && data && data.rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada jurnal HPP di rentang ini - klik &quot;Sync HPP dari Warehouse&quot;.</p>
          )}
          {!loading && data && data.rows.length > 0 && (
            <div className="overflow-x-auto -mx-6 px-6 min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead className="text-right">HPP</TableHead>
                    <TableHead>Jurnal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.outletName ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmtRp(r.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">#{r.id}</Badge>
                        {r.isLocked && <Badge variant="outline" className="ml-1">terkunci</Badge>}
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
