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
import { Plus, Users, Pencil, Search } from "lucide-react";

type Contact = {
  id: number;
  name: string;
  type: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  CUSTOMER: "Customer",
  VENDOR: "Vendor",
  EMPLOYEE: "Karyawan",
  OTHER: "Lainnya",
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

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);

  // Filter toolbar (client-side)
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("ALL");

  // Form state (dipakai bareng utk tambah & edit)
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/accounting/contacts?includeInactive=1")
      .then((r) => r.json())
      .then(setContacts)
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (filterType !== "ALL" && c.type !== filterType) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [contacts, search, filterType]);

  function openCreate() {
    setEditing(null);
    setName("");
    setType("");
    setPhone("");
    setEmail("");
    setAddress("");
    setDialogOpen(true);
  }

  function openEdit(c: Contact) {
    setEditing(c);
    setName(c.name);
    setType(c.type);
    setPhone(c.phone ?? "");
    setEmail(c.email ?? "");
    setAddress(c.address ?? "");
    setDialogOpen(true);
  }

  async function save() {
    if (!name.trim()) return toast.error("Nama kontak wajib diisi.");
    if (!type) return toast.error("Tipe kontak wajib dipilih.");

    const payload = {
      name: name.trim(),
      type,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
    };

    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/accounting/contacts/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) return toast.error(await friendlyError(res));
        toast.success(`Kontak "${name}" diperbarui.`);
      } else {
        const res = await fetch("/api/accounting/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) return toast.error(await friendlyError(res));
        toast.success(`Kontak "${name}" ditambahkan.`);
      }
      setDialogOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: Contact) {
    const res = await fetch(`/api/accounting/contacts/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    if (!res.ok) return toast.error(await friendlyError(res));
    load();
  }

  return (
    <div className="w-full grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Contact</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Customer, vendor, karyawan &amp; kontak lain yang dipakai di transaksi Accounting.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              // Tarik semua karyawan HR jadi kontak tipe Karyawan, status
              // ikut status kerja (resigned = nonaktif) - permintaan Kevin
              // 2026-09-15.
              const res = await fetch("/api/accounting/contacts/sync-employees", { method: "POST" });
              const d = await res.json();
              if (!res.ok) return toast.error(d.error ?? "Gagal sync karyawan.");
              toast.success(`Sync karyawan selesai: ${d.total} karyawan (${d.created} baru, ${d.updated} diperbarui) - ${d.active} aktif, ${d.inactive} nonaktif.`);
              load();
            }}
          >
            Sync dari Database Karyawan
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> Tambah Kontak
          </Button>
        </div>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Daftar Kontak ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Cari nama / telepon / email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterType} onValueChange={(v) => setFilterType(v ?? "ALL")}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue>{() => (filterType === "ALL" ? "Semua" : TYPE_LABEL[filterType] ?? "Semua")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua</SelectItem>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada kontak.</p>
          )}
          {!loading && filtered.length > 0 && (
            <div className="overflow-x-auto -mx-6 px-6 min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Telepon</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium whitespace-nowrap">{c.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{TYPE_LABEL[c.type] ?? c.type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{c.phone ?? "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.email ?? "-"}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => toggleActive(c)}
                          className={`text-xs rounded-full px-2 py-0.5 ${c.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}
                          title="Klik utk ubah status aktif/nonaktif"
                        >
                          {c.isActive ? "Aktif" : "Nonaktif"}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(c)} title="Edit kontak">
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
            <DialogTitle>{editing ? "Edit Kontak" : "Tambah Kontak"}</DialogTitle>
            <DialogDescription>
              {editing ? "Ubah data kontak lalu simpan." : "Kontak ini bisa dipilih saat input jurnal / pengeluaran."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Nama</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. PT Sumber Daging" className="h-10" />
            </div>
            <div className="grid gap-1.5">
              <Label>Tipe</Label>
              <Select value={type} onValueChange={(v) => setType(v ?? "")}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Pilih tipe...">{() => (type ? TYPE_LABEL[type] : "Pilih tipe...")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Telepon (opsional)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="mis. 0812-3456-7890" className="h-10" />
            </div>
            <div className="grid gap-1.5">
              <Label>Email (opsional)</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mis. vendor@contoh.com" className="h-10" />
            </div>
            <div className="grid gap-1.5">
              <Label>Alamat (opsional)</Label>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Alamat lengkap" rows={3} />
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
