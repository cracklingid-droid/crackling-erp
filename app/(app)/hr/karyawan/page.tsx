"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, ArrowLeft } from "lucide-react";

type Employee = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  employeeCode: string | null;
  position: string | null;
  outlet: string | null;
  employmentStatus: string | null;
  status: string;
};

const STATUS_LABEL: Record<string, string> = { onboarding: "Onboarding", active: "Aktif", resigned: "Resign" };
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  onboarding: "outline",
  active: "default",
  resigned: "secondary",
};

export default function KaryawanPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/employees")
      .then((r) => r.json())
      .then(setEmployees)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama karyawan wajib diisi");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Karyawan ditambahkan. Lengkapi datanya di halaman detail.");
      setName("");
      setEmail("");
      setPhone("");
      setShowForm(false);
      load();
    } else {
      const err = await res.json();
      toast.error("Gagal: " + err.error);
    }
  }

  const onboardingCount = employees.filter((e) => e.status === "onboarding").length;
  const activeCount = employees.filter((e) => e.status === "active").length;

  return (
    <div className="max-w-5xl grid gap-6">
      <div>
        <Link href="/hr" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Human Resource
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-heading font-semibold tracking-tight">Database Karyawan</h1>
            <p className="text-muted-foreground text-sm">
              {employees.length} karyawan · {onboardingCount} perlu dilengkapi datanya · {activeCount} aktif
            </p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)} className="shrink-0 whitespace-nowrap">
            <Plus className="h-4 w-4" /> Tambah Karyawan
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Karyawan Baru (Manual)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Untuk karyawan lama yang tidak lewat proses Rekrutmen. Kandidat yang "Diterima" di Rekrutmen otomatis muncul di
              sini tanpa perlu ditambah manual.
            </p>
            <form onSubmit={handleSubmit} className="grid gap-4 max-w-lg">
              <div className="grid gap-1.5">
                <Label>Nama</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                </div>
                <div className="grid gap-1.5">
                  <Label>No. HP</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Batal</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Jabatan</TableHead>
                <TableHead>Outlet</TableHead>
                <TableHead>Status Kepegawaian</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && employees.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-muted-foreground">Belum ada karyawan.</TableCell></TableRow>
              )}
              {employees.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">
                    <Link href={`/hr/karyawan/${e.id}`} className="hover:underline">{e.name}</Link>
                    {e.employeeCode && <span className="text-xs text-muted-foreground ml-1.5">({e.employeeCode})</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.position || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.outlet || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground capitalize">{e.employmentStatus || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[e.status] ?? "outline"} className="font-normal">
                      {STATUS_LABEL[e.status] ?? e.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
