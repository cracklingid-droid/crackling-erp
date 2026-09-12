"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

type Alias = {
  id: number;
  machineName: string;
  createdAt: string;
  employee: { id: number; name: string; outlet: string | null };
  createdBy: { name: string } | null;
};
type EmployeeOption = { id: number; name: string };

function formatDateID(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// Kelola alias nama mesin absen -> karyawan - lihat semua mapping yang
// sudah dikonfirmasi (baik dari saran fuzzy-match saat upload, maupun
// ditambah manual di sini), hapus kalau ada yang keliru. Permintaan Kevin
// 2026-09-12 (sekalian dgn fitur saran pencocokan nama saat upload).
export default function AttendanceAliasPage() {
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [machineName, setMachineName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/payroll/attendance/name-aliases").then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ])
      .then(([aliasData, employeeData]) => {
        setAliases(aliasData);
        setEmployees(
          (Array.isArray(employeeData) ? employeeData : [])
            .filter((e: { status?: string }) => e.status !== "resigned")
            .map((e: { id: number; name: string }) => ({ id: e.id, name: e.name }))
            .sort((a: EmployeeOption, b: EmployeeOption) => a.name.localeCompare(b.name))
        );
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function addAlias() {
    if (!machineName.trim() || !employeeId) {
      toast.error("Nama di mesin absen dan karyawan wajib diisi");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/payroll/attendance/name-aliases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ machineName, employeeId: Number(employeeId) }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json();
      toast.error("Gagal simpan: " + err.error);
      return;
    }
    setMachineName("");
    setEmployeeId("");
    toast.success("Alias disimpan.");
    load();
  }

  async function deleteAlias(id: number) {
    const res = await fetch(`/api/payroll/attendance/name-aliases/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Gagal hapus alias");
      return;
    }
    toast.success("Alias dihapus.");
    load();
  }

  return (
    <div className="max-w-3xl grid gap-6">
      <div>
        <Link href="/hr/payroll/absensi" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Upload Absensi
        </Link>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Alias Nama Absensi</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Daftar nama dari mesin fingerprint yang sudah dipetakan ke karyawan tertentu (mis. "ahmad" → Ahmad Yani) - dipakai
          otomatis tiap kali upload absensi baru, tanpa perlu dikonfirmasi ulang.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tambah Alias Manual</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <Label>Nama di Mesin Absen</Label>
            <Input value={machineName} onChange={(e) => setMachineName(e.target.value)} placeholder="mis. ahmad" className="w-48" />
          </div>
          <div className="grid gap-1.5">
            <Label>Karyawan</Label>
            <Select value={employeeId} onValueChange={(v) => setEmployeeId(v ?? "")}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Pilih karyawan..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addAlias} disabled={saving}>
            <Plus className="h-3.5 w-3.5" /> Simpan
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alias Tersimpan ({aliases.length})</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama di Mesin Absen</TableHead>
                <TableHead>Karyawan</TableHead>
                <TableHead>Dibuat Oleh</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && aliases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">Belum ada alias tersimpan.</TableCell>
                </TableRow>
              )}
              {aliases.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.machineName}</TableCell>
                  <TableCell>
                    {a.employee.name}
                    {a.employee.outlet && <span className="text-muted-foreground"> · {a.employee.outlet}</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{a.createdBy?.name ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{formatDateID(a.createdAt)}</TableCell>
                  <TableCell>
                    <button type="button" onClick={() => deleteAlias(a.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
