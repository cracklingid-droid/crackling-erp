"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Scale, Search, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";

type BankAccountSummary = {
  id: number;
  name: string;
  bankName: string | null;
  lineCount: number;
  earliestDate: string | null;
  latestDate: string | null;
  latestBalance: number | null;
};
type Line = { id: number; date: string; description: string; amount: number; balance: number | null };

function fmtRp(n: number | null): string {
  if (n === null) return "-";
  return (n < 0 ? "-Rp" : "Rp") + Math.abs(n).toLocaleString("id-ID");
}
function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ReconciliationPage() {
  const [accounts, setAccounts] = useState<BankAccountSummary[] | null>(null);
  const [selected, setSelected] = useState<BankAccountSummary | null>(null);

  useEffect(() => {
    fetch("/api/accounting/bank-accounts")
      .then((r) => r.json())
      .then(setAccounts);
  }, []);

  if (selected) {
    return <BankAccountDetail account={selected} onBack={() => setSelected(null)} />;
  }

  const totalLines = accounts?.reduce((s, a) => s + a.lineCount, 0) ?? 0;

  return (
    <div className="max-w-4xl grid gap-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Rekonsiliasi Bank</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Mutasi rekening dari tiap akun bank - {totalLines.toLocaleString("id-ID")} baris tersimpan. Pencocokan ke jurnal
          menyusul (v1: mutasi sudah lengkap tersimpan, bisa dilihat &amp; dicari).
        </p>
      </div>

      <Card>
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
                    <TableHead className="text-right">Jml Baris</TableHead>
                    <TableHead>Rentang Tanggal</TableHead>
                    <TableHead className="text-right">Saldo Terakhir (Sumber)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((a) => (
                    <TableRow key={a.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(a)}>
                      <TableCell className="font-medium whitespace-normal min-w-56">{a.name}</TableCell>
                      <TableCell>{a.bankName ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.lineCount.toLocaleString("id-ID")}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {a.lineCount === 0 ? "-" : `${fmtDate(a.earliestDate)} - ${fmtDate(a.latestDate)}`}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmtRp(a.latestBalance)}</TableCell>
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

function BankAccountDetail({ account, onBack }: { account: BankAccountSummary; onBack: () => void }) {
  const [lines, setLines] = useState<Line[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const pageSize = 50;

  useEffect(() => {
    setLines(null);
    const params = new URLSearchParams({ page: String(page) });
    if (search.trim()) params.set("search", search.trim());
    fetch(`/api/accounting/bank-accounts/${account.id}/lines?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setLines(data.lines);
        setTotal(data.total);
      });
  }, [account.id, page, search]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="max-w-4xl grid gap-6">
      <div>
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Daftar Akun Bank
        </button>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">{account.name}</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {account.bankName} &middot; {total.toLocaleString("id-ID")} baris mutasi
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 grid gap-4 min-w-0">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Cari keterangan mutasi..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-sm">{fmtDate(l.date)}</TableCell>
                      <TableCell className="whitespace-normal min-w-64 text-sm text-muted-foreground">{l.description}</TableCell>
                      <TableCell className={`text-right tabular-nums whitespace-nowrap ${l.amount < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {fmtRp(l.amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">{fmtRp(l.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {lines && total > pageSize && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Halaman {page} dari {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Berikutnya <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
