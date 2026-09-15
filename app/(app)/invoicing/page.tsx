"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileText, Plus, Search, Trash2, QrCode, MessageCircle, Copy, Tags, Ban, CircleDollarSign, ExternalLink } from "lucide-react";
import { INVOICE_BRANCHES } from "@/lib/invoicing-config";
import { buildWaLink } from "@/lib/whatsapp";

type MenuItem = { warehouseItemId: number; sku: string; name: string; unit: string; price: number | null; isActive: boolean };
type InvoiceLine = { id: number; sku: string; name: string; unit: string; qty: number; unitPrice: number; subtotal: number };
type InvoiceRow = {
  id: number;
  number: string;
  branchCode: string;
  invoiceDate: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  notes: string | null;
  subtotal: number;
  discount: number;
  total: number;
  status: string;
  publicToken: string;
  cancelReason: string | null;
  paidAt: string | null;
  paidMethod: string | null;
  midtransQrImageUrl: string | null;
  midtransQrExpiresAt: string | null;
  lines: InvoiceLine[];
  createdBy?: { name: string } | null;
  paidBy?: { name: string } | null;
  paidBankAccount?: { name: string; bankName: string | null } | null;
};
type BankAccount = { id: number; name: string; bankName: string | null };
type FormLine = { warehouseItemId: number; sku: string; name: string; unit: string; qty: number; unitPrice: number };

function fmtRp(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function parseRupiah(s: string) {
  const d = s.replace(/\D/g, "");
  return d ? Number(d) : 0;
}
function fmtInput(n: number) {
  return n ? n.toLocaleString("id-ID") : "";
}
function todayDate() {
  return new Date().toISOString().slice(0, 10);
}
function branchName(code: string) {
  return INVOICE_BRANCHES.find((b) => b.code === code)?.name ?? code;
}
async function friendlyError(res: Response) {
  try {
    return (await res.json()).error ?? "Terjadi kesalahan.";
  } catch {
    return "Terjadi kesalahan.";
  }
}
function statusBadge(status: string) {
  if (status === "paid") return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">Lunas</Badge>;
  if (status === "cancelled") return <Badge variant="outline" className="text-muted-foreground">Dibatalkan</Badge>;
  return <Badge variant="outline" className="text-amber-700 border-amber-300">Belum Lunas</Badge>;
}
function buildInvoiceWaMessage(inv: InvoiceRow, publicUrl: string): string {
  return `Halo ${inv.customerName}, berikut invoice dari Crackling ${branchName(inv.branchCode)}.

No. Invoice: ${inv.number}
Tanggal: ${fmtDate(inv.invoiceDate)}
Total: ${fmtRp(inv.total)}

Lihat rincian & bayar (QRIS) di sini:
${publicUrl}

Terima kasih!`;
}

export default function InvoicingPage() {
  const [branchFilter, setBranchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [start, setStart] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [end, setEnd] = useState(todayDate());

  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [totals, setTotals] = useState({ count: 0, unpaid: 0, paid: 0 });
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [detail, setDetail] = useState<InvoiceRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load() {
    const params = new URLSearchParams({ start, end });
    if (branchFilter) params.set("branch", branchFilter);
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/invoicing?${params}`);
    if (!res.ok) return toast.error("Gagal memuat daftar invoice.");
    const d = await res.json();
    setInvoices(d.invoices);
    setTotals(d.totals);
  }
  async function loadMenu() {
    const res = await fetch("/api/invoicing/items");
    if (res.ok) setMenu(await res.json());
  }
  async function loadBankAccounts() {
    const res = await fetch("/api/accounting/bank-accounts");
    if (res.ok) setBankAccounts(await res.json());
  }

  useEffect(() => {
    load();
    loadMenu();
    loadBankAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDetail(id: number) {
    setDetailLoading(true);
    const res = await fetch(`/api/invoicing/${id}`);
    setDetailLoading(false);
    if (!res.ok) return toast.error(await friendlyError(res));
    setDetail(await res.json());
  }

  async function refreshDetail(id: number) {
    const res = await fetch(`/api/invoicing/${id}`);
    if (res.ok) setDetail(await res.json());
  }

  return (
    <div className="w-full grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Invoicing</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Invoice manual per cabang utk menu (item SKU &quot;ESB...&quot;), dikirim ke WhatsApp customer, dibayar via QRIS
            (Midtrans). Nomor invoice otomatis mengikuti cabang.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setPriceOpen(true)}>
            <Tags className="h-3.5 w-3.5" /> Harga Jual Menu
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Buat Invoice
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Jumlah Invoice</p>
          <p className="text-xl font-heading font-semibold tabular-nums mt-1">{totals.count}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Belum Lunas</p>
          <p className="text-xl font-heading font-semibold tabular-nums mt-1 text-amber-700">{fmtRp(totals.unpaid)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Lunas</p>
          <p className="text-xl font-heading font-semibold tabular-nums mt-1 text-emerald-700">{fmtRp(totals.paid)}</p>
        </div>
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
          <div className="grid gap-1.5">
            <Label>Cabang</Label>
            <Select value={branchFilter || "all"} onValueChange={(v) => setBranchFilter(!v || v === "all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue>{() => (branchFilter ? branchName(branchFilter) : "Semua cabang")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua cabang</SelectItem>
                {INVOICE_BRANCHES.map((b) => (
                  <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(!v || v === "all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue>{() => (statusFilter === "unpaid" ? "Belum Lunas" : statusFilter === "paid" ? "Lunas" : statusFilter === "cancelled" ? "Dibatalkan" : "Semua status")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                <SelectItem value="unpaid">Belum Lunas</SelectItem>
                <SelectItem value="paid">Lunas</SelectItem>
                <SelectItem value="cancelled">Dibatalkan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={load} className="w-full sm:w-fit">Lihat</Button>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Daftar Invoice ({invoices?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          {!invoices && <p className="text-sm text-muted-foreground">Memuat...</p>}
          {invoices && invoices.length === 0 && <p className="text-sm text-muted-foreground">Belum ada invoice di rentang ini.</p>}
          {invoices && invoices.length > 0 && (
            <div className="overflow-x-auto -mx-6 px-6 min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Invoice</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Cabang</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id} className="cursor-pointer" onClick={() => openDetail(inv.id)}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{inv.number}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(inv.invoiceDate)}</TableCell>
                      <TableCell className="whitespace-nowrap">{branchName(inv.branchCode)}</TableCell>
                      <TableCell>{inv.customerName}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmtRp(inv.total)}</TableCell>
                      <TableCell>{statusBadge(inv.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateInvoiceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        menu={menu}
        onCreated={(id) => {
          load();
          openDetail(id);
        }}
      />
      <PriceDialog open={priceOpen} onOpenChange={setPriceOpen} menu={menu} onChanged={loadMenu} />
      <DetailInvoiceDialog
        invoice={detail}
        loading={detailLoading}
        bankAccounts={bankAccounts}
        onOpenChange={(open) => !open && setDetail(null)}
        onRefresh={() => detail && refreshDetail(detail.id)}
        onListChanged={load}
      />
    </div>
  );
}

// ==================== Buat Invoice ====================

function CreateInvoiceDialog({
  open,
  onOpenChange,
  menu,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  menu: MenuItem[];
  onCreated: (id: number) => void;
}) {
  const [branchCode, setBranchCode] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayDate());
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("");
  const [lines, setLines] = useState<FormLine[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setBranchCode("");
      setInvoiceDate(todayDate());
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setNotes("");
      setDiscount("");
      setLines([]);
      setItemSearch("");
    }
  }, [open]);

  const q = itemSearch.trim().toLowerCase();
  const results = q ? menu.filter((m) => m.name.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q)).slice(0, 8) : [];

  function addLine(item: MenuItem) {
    if (lines.some((l) => l.warehouseItemId === item.warehouseItemId)) {
      toast.error(`"${item.name}" sudah ada di daftar - ubah qty-nya langsung.`);
      return;
    }
    setLines((cur) => [...cur, { warehouseItemId: item.warehouseItemId, sku: item.sku, name: item.name, unit: item.unit, qty: 1, unitPrice: item.price ?? 0 }]);
    setItemSearch("");
  }
  function updateLine(i: number, patch: Partial<FormLine>) {
    setLines((cur) => cur.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setLines((cur) => cur.filter((_, idx) => idx !== i));
  }

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const discountValue = parseRupiah(discount);
  const total = Math.max(0, subtotal - discountValue);

  async function save() {
    if (!branchCode) return toast.error("Pilih cabang dulu.");
    if (!customerName.trim()) return toast.error("Nama customer wajib diisi.");
    if (!customerPhone.trim()) return toast.error("No. WhatsApp customer wajib diisi.");
    if (lines.length === 0) return toast.error("Tambah minimal 1 item.");
    for (const l of lines) {
      if (l.qty <= 0) return toast.error(`Qty "${l.name}" harus > 0.`);
      if (l.unitPrice <= 0) return toast.error(`Harga "${l.name}" belum diatur - isi di "Harga Jual Menu" dulu, atau isi manual di baris ini.`);
    }
    setSaving(true);
    try {
      const res = await fetch("/api/invoicing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchCode,
          invoiceDate,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerAddress: customerAddress.trim() || null,
          notes: notes.trim() || null,
          discount: discountValue,
          lines: lines.map((l) => ({ warehouseItemId: l.warehouseItemId, qty: l.qty, unitPrice: l.unitPrice })),
        }),
      });
      if (!res.ok) return toast.error(await friendlyError(res));
      const created = await res.json();
      toast.success(`Invoice ${created.number} dibuat & dijurnal.`);
      onOpenChange(false);
      onCreated(created.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Invoice</DialogTitle>
          <DialogDescription>Pilih cabang, isi data customer, lalu tambahkan item dari katalog menu.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Cabang</Label>
              <Select value={branchCode} onValueChange={(v) => setBranchCode(v ?? "")}>
                <SelectTrigger>
                  <SelectValue>{() => (branchCode ? branchName(branchCode) : "Pilih cabang...")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_BRANCHES.map((b) => (
                    <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Tanggal Invoice</Label>
              <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Nama Customer</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="mis. Budi Santoso" />
            </div>
            <div className="grid gap-1.5">
              <Label>No. WhatsApp Customer</Label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="08xx atau 62xx" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Alamat (opsional)</Label>
            <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Catatan (opsional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="grid gap-1.5">
            <Label>Tambah Item Menu</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Cari nama atau SKU menu (ESB...)..." value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} />
            </div>
            {results.length > 0 && (
              <div className="border rounded-md divide-y max-h-52 overflow-y-auto">
                {results.map((m) => (
                  <button
                    type="button"
                    key={m.warehouseItemId}
                    onClick={() => addLine(m)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-muted"
                  >
                    <span>
                      <span className="font-medium">{m.name}</span>{" "}
                      <span className="text-muted-foreground text-xs">{m.sku} · {m.unit}</span>
                    </span>
                    <span className="tabular-nums text-xs shrink-0">
                      {m.price ? fmtRp(m.price) : <span className="text-amber-700">belum diatur</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {lines.length > 0 && (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-3">Item</TableHead>
                    <TableHead className="w-20 text-right">Qty</TableHead>
                    <TableHead className="w-32 text-right">Harga</TableHead>
                    <TableHead className="w-32 text-right">Subtotal</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, i) => (
                    <TableRow key={l.warehouseItemId}>
                      <TableCell className="pl-3">
                        {l.name}
                        <div className="text-xs text-muted-foreground">{l.sku} · {l.unit}</div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={l.qty}
                          onChange={(e) => updateLine(i, { qty: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                          className="w-16 ml-auto text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={fmtInput(l.unitPrice)}
                          onChange={(e) => updateLine(i, { unitPrice: parseRupiah(e.target.value) })}
                          className="w-28 ml-auto text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmtRp(l.qty * l.unitPrice)}</TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLine(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
            <div className="grid gap-1.5">
              <Label>Diskon (opsional)</Label>
              <Input value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
            </div>
            <div className="text-right text-sm grid gap-0.5">
              <p>Subtotal: <span className="tabular-nums">{fmtRp(subtotal)}</span></p>
              <p className="text-base font-semibold">Total: <span className="tabular-nums">{fmtRp(total)}</span></p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Buat Invoice"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Harga Jual Menu ====================

function PriceDialog({ open, onOpenChange, menu, onChanged }: { open: boolean; onOpenChange: (v: boolean) => void; menu: MenuItem[]; onChanged: () => void }) {
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const q = search.trim().toLowerCase();
  const filtered = q ? menu.filter((m) => m.name.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q)) : menu;

  async function save(item: MenuItem) {
    const raw = drafts[item.warehouseItemId];
    const price = raw !== undefined ? parseRupiah(raw) : item.price ?? 0;
    setSavingId(item.warehouseItemId);
    try {
      const res = await fetch("/api/invoicing/items/price", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouseItemId: item.warehouseItemId, price }),
      });
      if (!res.ok) return toast.error(await friendlyError(res));
      toast.success(`Harga jual "${item.name}" disimpan.`);
      onChanged();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Harga Jual Menu</DialogTitle>
          <DialogDescription>
            Harga JUAL ke customer per item (SKU &quot;ESB...&quot;) - terpisah dari harga pokok/modal di Warehouse. Item yang
            belum diatur harganya tidak bisa dijual di invoice.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Cari nama atau SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="border rounded-md divide-y max-h-96 overflow-y-auto">
          {filtered.length === 0 && <p className="text-sm text-muted-foreground p-3">Tidak ada item ESB yang cocok.</p>}
          {filtered.map((item) => (
            <div key={item.warehouseItemId} className="flex items-center gap-2 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.sku} · {item.unit}</p>
              </div>
              <Input
                value={drafts[item.warehouseItemId] ?? fmtInput(item.price ?? 0)}
                onChange={(e) => setDrafts((cur) => ({ ...cur, [item.warehouseItemId]: e.target.value }))}
                className="w-28 text-right shrink-0"
              />
              <Button size="sm" variant="outline" className="shrink-0" disabled={savingId === item.warehouseItemId} onClick={() => save(item)}>
                Simpan
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Detail Invoice ====================

function DetailInvoiceDialog({
  invoice,
  loading,
  bankAccounts,
  onOpenChange,
  onRefresh,
  onListChanged,
}: {
  invoice: InvoiceRow | null;
  loading: boolean;
  bankAccounts: BankAccount[];
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
  onListChanged: () => void;
}) {
  const [qrLoading, setQrLoading] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [bankAccountId, setBankAccountId] = useState("");
  const [marking, setMarking] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const publicUrl = useMemo(() => {
    if (!invoice || typeof window === "undefined") return "";
    return `${window.location.origin}/invoice/${invoice.publicToken}`;
  }, [invoice]);

  async function generateQr() {
    if (!invoice) return;
    setQrLoading(true);
    try {
      const res = await fetch(`/api/invoicing/${invoice.id}/qr`, { method: "POST" });
      if (!res.ok) return toast.error(await friendlyError(res));
      toast.success("QR pembayaran dibuat.");
      onRefresh();
    } finally {
      setQrLoading(false);
    }
  }

  function sendWhatsapp() {
    if (!invoice) return;
    window.open(buildWaLink(invoice.customerPhone, buildInvoiceWaMessage(invoice, publicUrl)), "_blank");
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl);
    toast.success("Link invoice disalin.");
  }

  async function markPaid() {
    if (!invoice || !bankAccountId) return;
    setMarking(true);
    try {
      const res = await fetch(`/api/invoicing/${invoice.id}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankAccountId: Number(bankAccountId) }),
      });
      if (!res.ok) return toast.error(await friendlyError(res));
      toast.success("Invoice ditandai lunas.");
      setMarkPaidOpen(false);
      onRefresh();
      onListChanged();
    } finally {
      setMarking(false);
    }
  }

  async function cancelInvoice() {
    if (!invoice) return;
    if (!confirm(`Batalkan invoice ${invoice.number}? Jurnalnya akan dihapus.`)) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/invoicing/${invoice.id}`, { method: "DELETE" });
      if (!res.ok) return toast.error(await friendlyError(res));
      toast.success("Invoice dibatalkan.");
      onRefresh();
      onListChanged();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Dialog open={!!invoice || loading} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        {loading && !invoice && <p className="text-sm text-muted-foreground py-6 text-center">Memuat...</p>}
        {invoice && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-mono text-base">
                {invoice.number} {statusBadge(invoice.status)}
              </DialogTitle>
              <DialogDescription>
                {branchName(invoice.branchCode)} · {fmtDate(invoice.invoiceDate)}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-1 text-sm">
              <p><span className="text-muted-foreground">Customer:</span> {invoice.customerName}</p>
              <p><span className="text-muted-foreground">WhatsApp:</span> {invoice.customerPhone}</p>
              {invoice.customerAddress && <p><span className="text-muted-foreground">Alamat:</span> {invoice.customerAddress}</p>}
              {invoice.notes && <p><span className="text-muted-foreground">Catatan:</span> {invoice.notes}</p>}
            </div>

            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-3">Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right pr-3">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="pl-3">{l.name} <span className="text-muted-foreground text-xs">({fmtRp(l.unitPrice)}/{l.unit})</span></TableCell>
                      <TableCell className="text-right">{l.qty}</TableCell>
                      <TableCell className="text-right pr-3 tabular-nums">{fmtRp(l.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="text-right text-sm grid gap-0.5">
              <p>Subtotal: <span className="tabular-nums">{fmtRp(invoice.subtotal)}</span></p>
              {invoice.discount > 0 && <p>Diskon: <span className="tabular-nums">-{fmtRp(invoice.discount)}</span></p>}
              <p className="text-base font-semibold">Total: <span className="tabular-nums">{fmtRp(invoice.total)}</span></p>
            </div>

            {invoice.status === "paid" && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Lunas {invoice.paidAt && `pada ${fmtDateTime(invoice.paidAt)}`}
                {invoice.paidMethod === "midtrans_qris" && " via QRIS Midtrans"}
                {invoice.paidMethod === "manual" && invoice.paidBankAccount && ` - manual ke ${invoice.paidBankAccount.name}`}
                {invoice.paidBy && ` (dicatat oleh ${invoice.paidBy.name})`}
              </div>
            )}
            {invoice.status === "cancelled" && (
              <div className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
                Dibatalkan{invoice.cancelReason && ` - ${invoice.cancelReason}`}
              </div>
            )}

            {invoice.status === "unpaid" && (
              <div className="grid gap-3 border-t pt-4">
                <div className="grid gap-2">
                  <p className="text-sm font-medium flex items-center gap-1.5"><QrCode className="h-3.5 w-3.5" /> QR Pembayaran (QRIS)</p>
                  {invoice.midtransQrImageUrl ? (
                    <div className="flex flex-col items-center gap-1.5 border rounded-md p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={invoice.midtransQrImageUrl} alt="QR pembayaran" className="w-40 h-40" />
                      {invoice.midtransQrExpiresAt && (
                        <p className="text-xs text-muted-foreground">Kedaluwarsa {fmtDateTime(invoice.midtransQrExpiresAt)}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Belum ada QR - buat dulu di bawah.</p>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={generateQr} disabled={qrLoading}>
                    {qrLoading ? "Membuat QR..." : invoice.midtransQrImageUrl ? "Buat Ulang QR" : "Buat QR Pembayaran"}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={sendWhatsapp}>
                    <MessageCircle className="h-3.5 w-3.5" /> Kirim ke WhatsApp
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={copyLink}>
                    <Copy className="h-3.5 w-3.5" /> Salin Link
                  </Button>
                  <Button type="button" variant="outline" size="sm" render={<a href={publicUrl} target="_blank" rel="noreferrer" />} nativeButton={false}>
                    <ExternalLink className="h-3.5 w-3.5" /> Lihat Halaman Invoice
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 border-t pt-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => setMarkPaidOpen(true)}>
                    <CircleDollarSign className="h-3.5 w-3.5" /> Tandai Lunas Manual
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={cancelInvoice} disabled={cancelling}>
                    <Ban className="h-3.5 w-3.5" /> {cancelling ? "Membatalkan..." : "Batalkan Invoice"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>

      <Dialog open={markPaidOpen} onOpenChange={setMarkPaidOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Tandai Lunas Manual</DialogTitle>
            <DialogDescription>Pilih akun Kas/Bank tujuan penerimaan uangnya.</DialogDescription>
          </DialogHeader>
          <Select value={bankAccountId} onValueChange={(v) => setBankAccountId(v ?? "")}>
            <SelectTrigger>
              <SelectValue>{() => bankAccounts.find((b) => String(b.id) === bankAccountId)?.name ?? "Pilih akun..."}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {bankAccounts.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>{b.name}{b.bankName ? ` (${b.bankName})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidOpen(false)}>Batal</Button>
            <Button onClick={markPaid} disabled={marking || !bankAccountId}>{marking ? "Menyimpan..." : "Tandai Lunas"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
