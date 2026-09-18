"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Landmark, Pencil, TrendingDown } from "lucide-react";

type Account = {
  id: number;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
};
type AccountRef = { id: number; code: string; name: string } | null;
type FixedAssetRow = {
  id: number;
  name: string;
  category: string;
  acquisitionDate: string;
  acquisitionCost: number;
  usefulLifeMonths: number;
  residualValue: number;
  assetAccountId: number;
  accumDepreciationAccountId: number;
  depreciationExpenseAccountId: number;
  isActive: boolean;
  assetAccount: AccountRef;
  accumDepreciationAccount: AccountRef;
  depreciationExpenseAccount: AccountRef;
  monthlyDepreciation: number;
  accumulatedDepreciation: number;
  bookValue: number;
  lastDepreciatedMonth: string | null;
  depreciationCount: number;
};

// Kode akun default utk aset baru (template COA F&B) - kalau tidak ada, select
// dibiarkan kosong.
const DEFAULT_ASSET_CODE = "1-2000";
const DEFAULT_ACCUM_CODE = "1-2900";
const DEFAULT_EXPENSE_CODE = "6-1300";

function fmtRp(n: number): string {
  return (n < 0 ? "-Rp" : "Rp") + Math.abs(n).toLocaleString("id-ID");
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
function fmtMonth(yearMonth: string | null): string {
  if (!yearMonth) return "-";
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("id-ID", { month: "short", year: "numeric", timeZone: "UTC" });
}
// Input rupiah: disimpan angka polos, tampilannya diformat saat mengetik.
function parseRupiahInput(s: string): number {
  const digits = s.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}
function formatRupiahInput(n: number): string {
  return n ? n.toLocaleString("id-ID") : "";
}
function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function friendlyError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data.error ?? "Terjadi kesalahan.";
  } catch {
    return "Terjadi kesalahan.";
  }
}

export default function FixedAssetsPage() {
  const [assets, setAssets] = useState<FixedAssetRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FixedAssetRow | null>(null);

  // Form state (dipakai bareng utk tambah & edit)
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [acquisitionDate, setAcquisitionDate] = useState("");
  const [acquisitionCost, setAcquisitionCost] = useState(0);
  const [usefulLifeMonths, setUsefulLifeMonths] = useState("");
  const [residualValue, setResidualValue] = useState(0);
  const [assetAccountId, setAssetAccountId] = useState("");
  const [accumAccountId, setAccumAccountId] = useState("");
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [postAcquisition, setPostAcquisition] = useState(false);
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [saving, setSaving] = useState(false);

  // Posting penyusutan bulanan
  const [depMonth, setDepMonth] = useState(currentYearMonth());
  const [depreciating, setDepreciating] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/accounting/fixed-assets")
      .then((r) => r.json())
      .then(setAssets)
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    fetch("/api/accounting/coa")
      .then((r) => r.json())
      .then(setAccounts);
  }, []);

  const activeAccounts = accounts.filter((a) => a.isActive);
  const assetAccounts = activeAccounts.filter((a) => a.type === "ASSET");
  const expenseAccounts = activeAccounts.filter((a) => a.type === "EXPENSE");
  // Kas/Bank = akun aset berkode 1-10xx (termasuk sub-akunnya).
  const paymentAccounts = assetAccounts.filter((a) => a.code.startsWith("1-10"));

  function accountLabel(id: string): string {
    if (!id) return "";
    const acc = accounts.find((a) => a.id === Number(id));
    return acc ? `${acc.code} - ${acc.name}` : "";
  }
  function idByCode(code: string): string {
    const acc = accounts.find((a) => a.code === code);
    return acc ? String(acc.id) : "";
  }

  // Harga/tanggal/akun dikunci setelah ada posting penyusutan (server juga menolak).
  const coreLocked = !!editing && editing.depreciationCount > 0;

  function openCreate() {
    setEditing(null);
    setName("");
    setCategory("");
    setAcquisitionDate("");
    setAcquisitionCost(0);
    setUsefulLifeMonths("");
    setResidualValue(0);
    setAssetAccountId(idByCode(DEFAULT_ASSET_CODE));
    setAccumAccountId(idByCode(DEFAULT_ACCUM_CODE));
    setExpenseAccountId(idByCode(DEFAULT_EXPENSE_CODE));
    setPostAcquisition(false);
    setPaymentAccountId("");
    setDialogOpen(true);
  }

  function openEdit(asset: FixedAssetRow) {
    setEditing(asset);
    setName(asset.name);
    setCategory(asset.category);
    setAcquisitionDate(asset.acquisitionDate.slice(0, 10));
    setAcquisitionCost(asset.acquisitionCost);
    setUsefulLifeMonths(String(asset.usefulLifeMonths));
    setResidualValue(asset.residualValue);
    setAssetAccountId(String(asset.assetAccountId));
    setAccumAccountId(String(asset.accumDepreciationAccountId));
    setExpenseAccountId(String(asset.depreciationExpenseAccountId));
    setPostAcquisition(false);
    setPaymentAccountId("");
    setDialogOpen(true);
  }

  async function save() {
    const life = Number(usefulLifeMonths);
    if (!name.trim()) return toast.error("Nama aset wajib diisi.");
    if (!category.trim()) return toast.error("Kategori wajib diisi.");
    if (!acquisitionDate) return toast.error("Tanggal perolehan wajib diisi.");
    if (acquisitionCost <= 0) return toast.error("Harga perolehan harus lebih dari 0.");
    if (!Number.isInteger(life) || life < 1) return toast.error("Umur ekonomis minimal 1 bulan.");
    if (residualValue >= acquisitionCost) return toast.error("Nilai residu harus lebih kecil dari harga perolehan.");
    if (!assetAccountId || !accumAccountId || !expenseAccountId) return toast.error("Ketiga akun wajib dipilih.");
    if (!editing && postAcquisition && !paymentAccountId) return toast.error("Pilih akun pembayaran utk jurnal perolehan.");

    setSaving(true);
    try {
      if (editing) {
        const payload: Record<string, unknown> = {
          name: name.trim(),
          category: category.trim(),
          usefulLifeMonths: life,
          residualValue,
        };
        if (!coreLocked) {
          payload.acquisitionDate = acquisitionDate;
          payload.acquisitionCost = acquisitionCost;
          payload.assetAccountId = Number(assetAccountId);
          payload.accumDepreciationAccountId = Number(accumAccountId);
          payload.depreciationExpenseAccountId = Number(expenseAccountId);
        }
        const res = await fetch(`/api/accounting/fixed-assets/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) return toast.error(await friendlyError(res));
        toast.success(`Aset "${name}" diperbarui.`);
      } else {
        const res = await fetch("/api/accounting/fixed-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            category: category.trim(),
            acquisitionDate,
            acquisitionCost,
            usefulLifeMonths: life,
            residualValue,
            assetAccountId: Number(assetAccountId),
            accumDepreciationAccountId: Number(accumAccountId),
            depreciationExpenseAccountId: Number(expenseAccountId),
            postAcquisition,
            paymentAccountId: postAcquisition ? Number(paymentAccountId) : undefined,
          }),
        });
        if (!res.ok) return toast.error(await friendlyError(res));
        toast.success(postAcquisition ? `Aset "${name}" ditambahkan & jurnal perolehan dicatat.` : `Aset "${name}" ditambahkan.`);
      }
      setDialogOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(asset: FixedAssetRow) {
    const res = await fetch(`/api/accounting/fixed-assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !asset.isActive }),
    });
    if (!res.ok) return toast.error(await friendlyError(res));
    load();
  }

  async function runDepreciation() {
    if (!/^\d{4}-\d{2}$/.test(depMonth)) return toast.error("Pilih bulan penyusutan dulu.");
    setDepreciating(true);
    try {
      const res = await fetch("/api/accounting/fixed-assets/depreciate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearMonth: depMonth }),
      });
      if (!res.ok) return toast.error(await friendlyError(res));
      const summary: { postedAssets: number; totalAmount: number; skipped: number } = await res.json();
      if (summary.postedAssets === 0) {
        toast.info(`Tidak ada penyusutan utk ${fmtMonth(depMonth)} (${summary.skipped} aset dilewati).`);
      } else {
        toast.success(`Penyusutan ${fmtMonth(depMonth)} diposting: ${summary.postedAssets} aset, total ${fmtRp(summary.totalAmount)}.`);
      }
      load();
    } finally {
      setDepreciating(false);
    }
  }

  function renderAccountSelect(label: string, value: string, onChange: (v: string) => void, options: Account[], disabled = false) {
    return (
      <div className="grid gap-1.5">
        <Label>{label}</Label>
        <Select value={value} onValueChange={(v) => onChange(v ?? "")} disabled={disabled}>
          <SelectTrigger className="h-10 w-full">
            <SelectValue placeholder="Pilih akun...">{() => accountLabel(value) || "Pilih akun..."}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>{a.code} - {a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="w-full grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Fixed Asset</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Daftar aset tetap &amp; penyusutan garis lurus (straight-line) per bulan. Mulai kosong - isi aset satu per satu.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> Tambah Aset
        </Button>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Landmark className="h-4 w-4" /> Daftar Aset Tetap ({assets.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}
          {!loading && assets.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada aset tetap. Klik &quot;Tambah Aset&quot; utk mulai.</p>
          )}
          {!loading && assets.length > 0 && (
            <div className="overflow-x-auto -mx-6 px-6 min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Tgl Perolehan</TableHead>
                    <TableHead className="text-right">Harga Perolehan</TableHead>
                    <TableHead className="text-right">Umur (bulan)</TableHead>
                    <TableHead className="text-right">Penyusutan/bulan</TableHead>
                    <TableHead className="text-right">Akumulasi</TableHead>
                    <TableHead className="text-right">Nilai Buku</TableHead>
                    <TableHead>Terakhir disusutkan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((a) => (
                    <TableRow key={a.id} className={a.isActive ? "" : "opacity-60"}>
                      <TableCell className="font-medium whitespace-normal min-w-44">
                        {a.name}
                        <div className="text-xs text-muted-foreground font-normal font-mono">{a.assetAccount?.code ?? "-"}</div>
                      </TableCell>
                      <TableCell className="text-sm">{a.category}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{fmtDate(a.acquisitionDate)}</TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">{fmtRp(a.acquisitionCost)}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.usefulLifeMonths}</TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">{fmtRp(a.monthlyDepreciation)}</TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">{fmtRp(a.accumulatedDepreciation)}</TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap font-medium">{fmtRp(a.bookValue)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{fmtMonth(a.lastDepreciatedMonth)}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => toggleActive(a)}
                          className={`text-xs rounded-full px-2 py-0.5 whitespace-nowrap ${a.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}
                          title="Klik utk ubah status aktif/nonaktif (aset nonaktif tidak ikut disusutkan)"
                        >
                          {a.isActive ? "Aktif" : "Nonaktif"}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(a)} title="Edit aset">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4" /> Posting Penyusutan Bulanan
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Posting jurnal penyusutan (Dr Beban Penyusutan / Cr Akumulasi Penyusutan) utk semua aset aktif di bulan yang
            dipilih. Aman diklik ulang utk bulan yang sama - jurnal lama diganti, tidak dobel.
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="grid gap-1.5">
              <Label>Bulan</Label>
              <Input type="month" value={depMonth} onChange={(e) => setDepMonth(e.target.value)} className="h-10 w-full sm:w-44" />
            </div>
            <Button onClick={runDepreciation} disabled={depreciating || assets.length === 0}>
              {depreciating ? "Memposting..." : "Posting Penyusutan"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Aset" : "Tambah Aset"}</DialogTitle>
            <DialogDescription>
              {editing
                ? coreLocked
                  ? "Harga, tanggal perolehan & akun dikunci karena sudah ada posting penyusutan."
                  : "Belum ada posting penyusutan - semua field masih bisa diubah."
                : "Penyusutan dihitung garis lurus: (harga perolehan - residu) / umur ekonomis per bulan."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Nama Aset</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Oven Deck 2 Tingkat" className="h-10" />
            </div>
            <div className="grid gap-1.5">
              <Label>Kategori</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="mis. Peralatan Dapur" className="h-10" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Tgl Perolehan</Label>
                <Input type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} className="h-10" disabled={coreLocked} />
              </div>
              <div className="grid gap-1.5">
                <Label>Harga Perolehan (Rp)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={formatRupiahInput(acquisitionCost)}
                  onChange={(e) => setAcquisitionCost(parseRupiahInput(e.target.value))}
                  placeholder="0"
                  className="h-10 tabular-nums text-right"
                  disabled={coreLocked}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Umur Ekonomis (bulan)</Label>
                <Input
                  type="number"
                  min={1}
                  value={usefulLifeMonths}
                  onChange={(e) => setUsefulLifeMonths(e.target.value)}
                  placeholder="mis. 48"
                  className="h-10 tabular-nums text-right"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Nilai Residu (Rp)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={formatRupiahInput(residualValue)}
                  onChange={(e) => setResidualValue(parseRupiahInput(e.target.value))}
                  placeholder="0"
                  className="h-10 tabular-nums text-right"
                />
              </div>
            </div>
            {acquisitionCost > 0 && Number(usefulLifeMonths) >= 1 && residualValue < acquisitionCost && (
              <p className="text-xs text-muted-foreground">
                Penyusutan/bulan: {fmtRp(Math.floor((acquisitionCost - residualValue) / Number(usefulLifeMonths)))}
              </p>
            )}

            {renderAccountSelect("Akun Aset Tetap", assetAccountId, setAssetAccountId, assetAccounts, coreLocked)}
            {renderAccountSelect("Akun Akumulasi Penyusutan", accumAccountId, setAccumAccountId, assetAccounts, coreLocked)}
            {renderAccountSelect("Akun Beban Penyusutan", expenseAccountId, setExpenseAccountId, expenseAccounts, coreLocked)}

            {!editing && (
              <>
                <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-primary"
                    checked={postAcquisition}
                    onChange={(e) => setPostAcquisition(e.target.checked)}
                  />
                  Catat jurnal perolehan (Dr Aset Tetap / Cr akun pembayaran)
                </label>
                {postAcquisition && renderAccountSelect("Akun Pembayaran (Kas/Bank)", paymentAccountId, setPaymentAccountId, paymentAccounts)}
                <p className="text-xs text-muted-foreground">
                  Aset yang dibeli sebelum buku besar dimulai: JANGAN centang jurnal perolehan - nilainya masuk lewat saldo awal.
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
