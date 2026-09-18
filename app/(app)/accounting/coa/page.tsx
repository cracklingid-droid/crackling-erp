"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, BookOpen, Pencil } from "lucide-react";

type Account = {
  id: number;
  code: string;
  name: string;
  type: string;
  subType: string | null;
  parentId: number | null;
  isActive: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  ASSET: "Aset",
  LIABILITY: "Liabilitas",
  EQUITY: "Ekuitas",
  REVENUE: "Pendapatan",
  EXPENSE: "Beban",
};
const TYPES = Object.keys(TYPE_LABEL);

async function friendlyError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data.error ?? "Terjadi kesalahan.";
  } catch {
    return "Terjadi kesalahan.";
  }
}

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  // Form state (dipakai bareng utk tambah & edit)
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [subType, setSubType] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/accounting/coa")
      .then((r) => r.json())
      .then(setAccounts)
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openCreate() {
    setEditing(null);
    setCode("");
    setName("");
    setType("");
    setSubType("");
    setParentId("");
    setDialogOpen(true);
  }

  function openEdit(acc: Account) {
    setEditing(acc);
    setCode(acc.code);
    setName(acc.name);
    setType(acc.type);
    setSubType(acc.subType ?? "");
    setParentId(acc.parentId ? String(acc.parentId) : "");
    setDialogOpen(true);
  }

  async function save() {
    if (!name.trim()) return toast.error("Nama akun wajib diisi.");
    if (!editing && !code.trim()) return toast.error("Kode akun wajib diisi.");
    if (!type) return toast.error("Tipe akun wajib dipilih.");

    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/accounting/coa/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            subType: subType.trim() || null,
            parentId: parentId ? Number(parentId) : null,
          }),
        });
        if (!res.ok) return toast.error(await friendlyError(res));
        toast.success(`Akun "${name}" diperbarui.`);
      } else {
        const res = await fetch("/api/accounting/coa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: code.trim(),
            name: name.trim(),
            type,
            subType: subType.trim() || null,
            parentId: parentId ? Number(parentId) : null,
          }),
        });
        if (!res.ok) return toast.error(await friendlyError(res));
        toast.success(`Akun "${name}" ditambahkan.`);
      }
      setDialogOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(acc: Account) {
    const res = await fetch(`/api/accounting/coa/${acc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !acc.isActive }),
    });
    if (!res.ok) return toast.error(await friendlyError(res));
    load();
  }

  return (
    <div className="w-full grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Chart of Accounts</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Daftar akun (COA) - dasar semua jurnal di modul Accounting. Template standar F&amp;B sudah diisi, bisa
            ditambah/diedit di sini.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> Tambah Akun
        </Button>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Daftar Akun ({accounts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}
          {!loading && (
            <div className="min-w-0 overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode</TableHead>
                    <TableHead>Nama Akun</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Sub Tipe</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell className="font-mono text-sm whitespace-nowrap">{acc.code}</TableCell>
                      <TableCell className={acc.parentId ? "pl-6" : "font-medium"}>{acc.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{TYPE_LABEL[acc.type] ?? acc.type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{acc.subType ?? "-"}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => toggleActive(acc)}
                          className={`text-xs rounded-full px-2 py-0.5 ${acc.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}
                          title="Klik utk ubah status aktif/nonaktif"
                        >
                          {acc.isActive ? "Aktif" : "Nonaktif"}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(acc)} title="Edit akun">
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Akun" : "Tambah Akun"}</DialogTitle>
            <DialogDescription>
              {editing ? `Kode ${editing.code} (kode tidak bisa diubah)` : "Kode akun mis. \"6-1600\", sesuaikan urutan dgn tipe akunnya."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {!editing && (
              <div className="grid gap-1.5">
                <Label>Kode Akun</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="mis. 6-1600" className="h-10" />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>Nama Akun</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Beban Internet" className="h-10" />
            </div>
            <div className="grid gap-1.5">
              <Label>Tipe</Label>
              <Select value={type} onValueChange={(v) => setType(v ?? "")} disabled={!!editing}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Pilih tipe...">{() => (type ? TYPE_LABEL[type] : "Pilih tipe...")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editing && <p className="text-xs text-muted-foreground">Tipe tidak bisa diubah setelah dibuat.</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>Sub Tipe (opsional)</Label>
              <Input value={subType} onChange={(e) => setSubType(e.target.value)} placeholder="mis. Beban Operasional" className="h-10" />
            </div>
            <div className="grid gap-1.5">
              <Label>Induk Akun (opsional)</Label>
              <Select value={parentId || "none"} onValueChange={(v) => setParentId(v === "none" ? "" : v ?? "")}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue>
                    {() => (parentId ? accounts.find((a) => a.id === Number(parentId))?.name : "Tidak ada")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada</SelectItem>
                  {accounts.filter((a) => a.id !== editing?.id).map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.code} - {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
