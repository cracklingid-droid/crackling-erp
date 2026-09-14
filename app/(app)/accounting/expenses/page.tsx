"use client";

import { useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Receipt, Plus, Trash2, ScanLine, ImageIcon, X } from "lucide-react";
import { OUTLET_NAMES } from "@/lib/payroll-config";

type Account = { id: number; code: string; name: string; type: string; isActive: boolean };
type Contact = { id: number; name: string; type: string };
type ExpenseLine = { id: number; description: string; amount: number; accountId: number; account: { code: string; name: string } | null };
type Expense = {
  id: number;
  date: string;
  amount: number;
  description: string | null;
  outletName: string | null;
  receiptUrl: string | null;
  journalEntryId: number | null;
  isReconciled: boolean;
  contact: { id: number; name: string } | null;
  paymentAccount: { code: string; name: string } | null;
  lines: ExpenseLine[];
};
type FormLine = { description: string; amount: string; accountId: string };

function fmtRp(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}
function parseRupiah(s: string) {
  const d = s.replace(/\D/g, "");
  return d ? Number(d) : 0;
}
function fmtInput(n: number) {
  return n ? n.toLocaleString("id-ID") : "";
}
function isoDaysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function friendlyError(res: Response) {
  try {
    return (await res.json()).error ?? "Terjadi kesalahan.";
  } catch {
    return "Terjadi kesalahan.";
  }
}

export default function DirectExpensePage() {
  const [start, setStart] = useState(isoDaysAgo(29));
  const [end, setEnd] = useState(isoDaysAgo(0));
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [total, setTotal] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form
  const [date, setDate] = useState(isoDaysAgo(0));
  const [contactId, setContactId] = useState("");
  const [outletName, setOutletName] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<FormLine[]>([{ description: "", amount: "", accountId: "" }]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  const expenseAccounts = accounts.filter((a) => a.type === "EXPENSE" && a.isActive && !a.code.endsWith("-0000"));
  const paymentAccounts = accounts.filter((a) => a.type === "ASSET" && a.isActive && a.code.startsWith("1-10"));

  async function load() {
    const res = await fetch(`/api/accounting/expenses?${new URLSearchParams({ start, end })}`);
    if (!res.ok) return toast.error("Gagal memuat Direct Expense.");
    const d = await res.json();
    setExpenses(d.expenses);
    setTotal(d.total);
  }
  useEffect(() => {
    load();
    fetch("/api/accounting/coa").then((r) => r.json()).then(setAccounts);
    fetch("/api/accounting/contacts?type=VENDOR").then((r) => r.json()).then(setContacts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!receiptFile) {
      setReceiptPreview(null);
      return;
    }
    const url = URL.createObjectURL(receiptFile);
    setReceiptPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [receiptFile]);

  function openCreate() {
    setDate(isoDaysAgo(0));
    setContactId("");
    setOutletName("");
    setPaymentAccountId("");
    setDescription("");
    setLines([{ description: "", amount: "", accountId: "" }]);
    setReceiptFile(null);
    setDialogOpen(true);
  }

  function updateLine(i: number, patch: Partial<FormLine>) {
    setLines((cur) => cur.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  // Baca bon pakai Claude (route /scan) - hasilnya mengisi form, user tetap
  // cek & ubah sebelum simpan (akun beban cuma SARAN).
  async function scanReceipt(file: File) {
    setScanning(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch("/api/accounting/expenses/scan", { method: "POST", body: form });
      if (!res.ok) return toast.error(await friendlyError(res));
      const d = await res.json();
      if (d.receiptDate) setDate(d.receiptDate);
      if (d.vendorName && !description) setDescription(d.vendorName);
      if (d.lines?.length) {
        setLines(
          d.lines.map((l: { description: string; amount: number; suggestedAccountCode: string | null }) => ({
            description: l.description,
            amount: fmtInput(l.amount),
            accountId: String(accounts.find((a) => a.code === l.suggestedAccountCode)?.id ?? ""),
          }))
        );
      }
      toast.success(`Bon terbaca: ${d.lines?.length ?? 0} baris. Cek akun bebannya sebelum simpan.`);
    } finally {
      setScanning(false);
    }
  }

  async function save() {
    if (!paymentAccountId) return toast.error("Akun pembayaran (Kas/Bank) wajib dipilih.");
    const payloadLines = lines.map((l) => ({ description: l.description.trim(), amount: parseRupiah(l.amount), accountId: Number(l.accountId) || null }));
    for (const l of payloadLines) {
      if (!l.description) return toast.error("Keterangan tiap baris wajib diisi.");
      if (l.amount <= 0) return toast.error(`Nominal "${l.description}" harus > 0.`);
      if (!l.accountId) return toast.error(`Akun beban "${l.description}" wajib dipilih.`);
    }
    setSaving(true);
    try {
      let receiptUrl: string | null = null;
      if (receiptFile) {
        try {
          const blob = await upload(`expense-receipts/${Date.now()}-${receiptFile.name}`, receiptFile, {
            access: "public",
            handleUploadUrl: "/api/accounting/expenses/upload-receipt",
          });
          receiptUrl = blob.url;
        } catch {
          toast.error("Upload foto bon gagal - transaksi tetap disimpan tanpa foto.");
        }
      }
      const res = await fetch("/api/accounting/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          contactId: contactId ? Number(contactId) : null,
          outletName: outletName || null,
          paymentAccountId: Number(paymentAccountId),
          description: description || null,
          receiptUrl,
          lines: payloadLines,
        }),
      });
      if (!res.ok) return toast.error(await friendlyError(res));
      toast.success("Direct Expense tersimpan & dijurnal.");
      setDialogOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(e: Expense) {
    if (!confirm(`Hapus Direct Expense ${fmtRp(e.amount)} (${fmtDate(e.date)})? Jurnalnya ikut dihapus.`)) return;
    const res = await fetch(`/api/accounting/expenses/${e.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error(await friendlyError(res));
    toast.success("Direct Expense dihapus.");
    load();
  }

  const formTotal = lines.reduce((s, l) => s + parseRupiah(l.amount), 0);
  const accountLabel = (id: string) => {
    const a = accounts.find((x) => String(x.id) === id);
    return a ? `${a.code} - ${a.name}` : "";
  };

  return (
    <div className="max-w-5xl grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Direct Expense</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Beban langsung yang tidak jadi persediaan - gas, listrik, marketing, dst. Foto bon dibaca otomatis (Claude), lalu
            dijurnal <span className="font-medium text-foreground">Dr akun beban / Cr Kas-Bank</span>.
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="shrink-0">
          <Plus className="h-3.5 w-3.5" /> Catat Beban
        </Button>
      </div>

      <Card className="min-w-0">
        <CardContent className="pt-6 flex flex-col sm:flex-row flex-wrap gap-3 sm:items-end">
          <div className="grid gap-1.5">
            <Label>Dari</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full sm:w-40" />
          </div>
          <div className="grid gap-1.5">
            <Label>Sampai</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full sm:w-40" />
          </div>
          <Button onClick={load} className="w-full sm:w-fit">Lihat</Button>
          <p className="text-sm sm:ml-auto">
            Total: <span className="font-semibold tabular-nums">{fmtRp(total)}</span>
          </p>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Daftar Beban ({expenses?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          {!expenses && <p className="text-sm text-muted-foreground">Memuat...</p>}
          {expenses && expenses.length === 0 && <p className="text-sm text-muted-foreground">Belum ada beban di rentang ini.</p>}
          {expenses && expenses.length > 0 && (
            <div className="overflow-x-auto -mx-6 px-6 min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Dibayar dari</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">{fmtDate(e.date)}</TableCell>
                      <TableCell className="whitespace-normal min-w-56">
                        <div className="flex items-start gap-2">
                          {e.receiptUrl && (
                            <a href={e.receiptUrl} target="_blank" rel="noreferrer" className="shrink-0" title="Lihat foto bon">
                              <ImageIcon className="h-4 w-4 text-primary mt-0.5" />
                            </a>
                          )}
                          <div>
                            <p className="font-medium">{e.description ?? e.lines.map((l) => l.description).join(", ")}</p>
                            <p className="text-xs text-muted-foreground">
                              {e.lines.map((l) => `${l.account?.name ?? "?"} ${fmtRp(l.amount)}`).join(" · ")}
                              {e.outletName && ` · ${e.outletName}`}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{e.contact?.name ?? "-"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{e.paymentAccount?.name ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium whitespace-nowrap">{fmtRp(e.amount)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {e.isReconciled ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400" variant="outline">Reconciled</Badge>
                        ) : (
                          <Badge variant="outline">#{e.journalEntryId ?? "-"}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!e.isReconciled && (
                          <Button variant="ghost" size="icon-sm" onClick={() => remove(e)} title="Hapus">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Catat Direct Expense</DialogTitle>
            <DialogDescription>Foto bon dulu supaya terbaca otomatis, atau isi manual.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="flex items-center gap-3 rounded-md border border-dashed p-3">
              {receiptPreview ? (
                <div className="relative shrink-0">
                  <img src={receiptPreview} alt="" className="h-16 w-16 rounded-md object-cover border" />
                  <button type="button" onClick={() => setReceiptFile(null)} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center" aria-label="Hapus foto">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="h-16 w-16 rounded-md border border-dashed flex items-center justify-center text-muted-foreground shrink-0">
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}
              <div className="grid gap-2 flex-1 min-w-0">
                <label>
                  <span className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-accent">
                    <ScanLine className="h-4 w-4" /> {scanning ? "Membaca bon..." : "Foto / pilih bon & baca otomatis"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={scanning}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      if (!f) return;
                      setReceiptFile(f);
                      scanReceipt(f);
                    }}
                  />
                </label>
                <p className="text-xs text-muted-foreground">Foto disimpan sbg bukti. Hasil baca cuma saran - cek sebelum simpan.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Tanggal</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
              </div>
              <div className="grid gap-1.5">
                <Label>Dibayar dari (Kas/Bank)</Label>
                <Select value={paymentAccountId} onValueChange={(v) => setPaymentAccountId(v ?? "")}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue>{() => accountLabel(paymentAccountId) || "Pilih akun..."}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {paymentAccounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.code} - {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              <div className="grid gap-1.5">
                <Label>Outlet (opsional)</Label>
                <Select value={outletName || "none"} onValueChange={(v) => setOutletName(v === "none" ? "" : v ?? "")}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue>{() => outletName || "Kantor / lintas outlet"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kantor / lintas outlet</SelectItem>
                    {OUTLET_NAMES.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Keterangan (opsional)</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="mis. Tagihan listrik Serpong Agustus" className="h-10" />
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Rincian beban</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setLines((c) => [...c, { description: "", amount: "", accountId: "" }])}>
                  + Baris
                </Button>
              </div>
              {lines.map((l, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_9rem_1fr_auto] items-start rounded-md border p-2">
                  <Input placeholder="Keterangan" value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} className="h-10" />
                  <Input
                    inputMode="numeric"
                    placeholder="Rp"
                    value={l.amount}
                    onChange={(e) => updateLine(i, { amount: fmtInput(parseRupiah(e.target.value)) })}
                    className="h-10 text-right tabular-nums"
                  />
                  <Select value={l.accountId} onValueChange={(v) => updateLine(i, { accountId: v ?? "" })}>
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
              <p className="text-sm text-right">
                Total: <span className="font-semibold tabular-nums">{fmtRp(formTotal)}</span>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={save} disabled={saving || scanning}>{saving ? "Menyimpan..." : "Simpan & Jurnal"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
