"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Package, ExternalLink, AlertTriangle, ImagePlus } from "lucide-react";
import { upload } from "@vercel/blob/client";

// Baris dari GET /api/accounting/products (ProductRow Warehouse + photoUrl ERP)
type Product = {
  id: number;
  sku: string;
  name: string;
  categoryCode: string;
  unit: string;
  standardCost: number | null;
  fifoCost: number | null;
  lastPurchaseCost: number | null;
  lastPurchaseAt: string | null;
  stockQty: number;
  isActive: boolean;
  photoUrl: string | null;
};

// Label kategori - disalin dari Warehouse. Kode yang tidak dikenal tampil apa adanya.
const CATEGORY_LABEL: Record<string, string> = {
  FG: "Barang Jadi",
  SC: "Sauce",
  BM: "Bumbu",
  BV: "Minuman",
  ING: "Bahan Baku",
  CLN: "Kebersihan",
  PKG: "Kemasan",
  OPS: "Operasional",
  LAIN: "Lainnya",
  FROZEN: "Stock Frozen",
  GDG: "Barang Gudang",
  PASAR: "Bahan Pasar",
  FATGAI: "Bahan Fat Gai",
  RM: "Bahan Mentah",
  Bumb: "Bumbu",
  Pack: "Barang Gudang",
  Pend: "Barang Gudang",
  Minu: "Minuman",
};
const categoryLabel = (code: string) => CATEGORY_LABEL[code] ?? code;

const WAREHOUSE_ADD_ITEM_URL = "https://crackling-warehouse.vercel.app/tambah-item";

const rupiah = (n: number | null) => (n === null ? "-" : "Rp" + n.toLocaleString("id-ID"));
const qty = (n: number) => n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

async function friendlyError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data.error ?? "Terjadi kesalahan.";
  } catch {
    return "Terjadi kesalahan.";
  }
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [showInactive, setShowInactive] = useState(false);

  // Upload foto: satu input file tersembunyi dipakai bergantian utk semua baris
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingItemIdRef = useRef<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    setLoadError(null);
    fetch("/api/accounting/products")
      .then(async (res) => {
        if (!res.ok) {
          setLoadError(await friendlyError(res));
          setProducts([]);
          return;
        }
        setProducts(await res.json());
      })
      .catch(() => setLoadError("Gagal memuat data."))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  // Kategori yang benar-benar ada di data - per LABEL (bukan kode), krn
  // beberapa kode lama Warehouse berbagi label yang sama (GDG/Pack/Pend =
  // "Barang Gudang", BM/Bumb = "Bumbu") dan di dropdown tidak boleh dobel.
  const categories = useMemo(() => {
    const labels = Array.from(new Set(products.map((p) => categoryLabel(p.categoryCode))));
    return labels.sort((a, b) => a.localeCompare(b, "id"));
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (!showInactive && !p.isActive) return false;
      if (category !== "all" && categoryLabel(p.categoryCode) !== category) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, category, showInactive]);

  function patchProduct(id: number, patch: Partial<Product>) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function pickPhoto(itemId: number) {
    if (uploadingId !== null) return;
    pendingItemIdRef.current = itemId;
    fileInputRef.current?.click();
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const itemId = pendingItemIdRef.current;
    if (!file || itemId === null) return;
    setUploadingId(itemId);
    try {
      const blob = await upload(`product-photos/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/accounting/products/upload-photo",
        clientPayload: String(itemId),
      });
      const res = await fetch(`/api/accounting/products/${itemId}/photo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: blob.url }),
      });
      if (!res.ok) return toast.error("Gagal simpan foto: " + (await friendlyError(res)));
      patchProduct(itemId, { photoUrl: blob.url });
      toast.success("Foto produk disimpan.");
    } catch (err) {
      toast.error("Gagal upload foto: " + (err instanceof Error ? err.message : "unknown"));
    } finally {
      setUploadingId(null);
      pendingItemIdRef.current = null;
      e.target.value = "";
    }
  }

  async function removePhoto(p: Product) {
    if (!confirm(`Hapus foto "${p.name}"?`)) return;
    const res = await fetch(`/api/accounting/products/${p.id}/photo`, { method: "DELETE" });
    if (!res.ok) return toast.error("Gagal hapus foto: " + (await friendlyError(res)));
    patchProduct(p.id, { photoUrl: null });
    toast.success("Foto produk dihapus.");
  }

  return (
    <div className="max-w-6xl grid gap-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Product</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Katalog item Warehouse (live) - SKU, kategori, stok &amp; harga FIFO saat belanja. Item baru cukup dibuat di
            Warehouse, otomatis muncul di sini.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={WAREHOUSE_ADD_ITEM_URL} target="_blank" rel="noreferrer" />}
        >
          <ExternalLink className="h-3.5 w-3.5" /> Tambah item di Warehouse
        </Button>
      </div>

      {loadError && (
        <div className="flex items-start gap-2 text-sm rounded-md border border-amber-500/40 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            {loadError} Coba{" "}
            <button type="button" onClick={load} className="underline underline-offset-2">
              muat ulang
            </button>
            .
          </span>
        </div>
      )}

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" /> Daftar Item ({filtered.length}
            {filtered.length !== products.length ? ` dari ${products.length}` : ""})
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / SKU..."
              className="h-9 sm:w-64"
            />
            <Select value={category} onValueChange={(v) => setCategory(v ?? "all")}>
              <SelectTrigger className="h-9 sm:w-48">
                <SelectValue>{() => (category === "all" ? "Semua kategori" : category)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua kategori</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none sm:ml-auto">
              <input
                type="checkbox"
                className="accent-primary"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Tampilkan nonaktif
            </label>
          </div>

          {/* Input file tersembunyi - dipicu dari klik thumbnail foto di tabel */}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

          {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}
          {!loading && !loadError && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {products.length === 0 ? "Belum ada item di Warehouse." : "Tidak ada item yang cocok dengan filter."}
            </p>
          )}
          {!loading && filtered.length > 0 && (
            <div className="overflow-x-auto -mx-6 px-6 min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Foto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Satuan</TableHead>
                    <TableHead className="text-right">Stok</TableHead>
                    <TableHead className="text-right">Harga FIFO</TableHead>
                    <TableHead className="text-right">Beli Terakhir</TableHead>
                    <TableHead className="text-right">Harga Standar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const uploading = uploadingId === p.id;
                    return (
                      <TableRow key={p.id} className={p.isActive ? undefined : "text-muted-foreground"}>
                        <TableCell>
                          <div className="flex flex-col items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => pickPhoto(p.id)}
                              disabled={uploadingId !== null}
                              title={p.photoUrl ? "Klik utk ganti foto" : "Klik utk unggah foto"}
                              className="h-14 w-14 shrink-0 rounded-md overflow-hidden border border-dashed border-border flex items-center justify-center hover:bg-muted disabled:opacity-50 data-[has-photo=true]:border-solid"
                              data-has-photo={!!p.photoUrl}
                            >
                              {p.photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover" />
                              ) : (
                                <ImagePlus className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                            {uploading ? (
                              <span className="text-[11px] text-muted-foreground animate-pulse">Mengunggah...</span>
                            ) : (
                              p.photoUrl && (
                                <button
                                  type="button"
                                  onClick={() => removePhoto(p)}
                                  className="text-[11px] text-muted-foreground hover:text-destructive underline underline-offset-2"
                                >
                                  hapus
                                </button>
                              )
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm whitespace-nowrap">{p.sku}</TableCell>
                        <TableCell className="font-medium">
                          {p.name}
                          {!p.isActive && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              Nonaktif
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{categoryLabel(p.categoryCode)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{p.unit}</TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">{qty(p.stockQty)}</TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">{rupiah(p.fifoCost)}</TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">
                          {rupiah(p.lastPurchaseCost)}
                          {p.lastPurchaseAt && (
                            <div className="text-[11px] text-muted-foreground">{shortDate(p.lastPurchaseAt)}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">{rupiah(p.standardCost)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
