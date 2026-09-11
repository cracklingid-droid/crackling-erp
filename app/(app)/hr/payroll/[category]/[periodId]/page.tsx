"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Lock, Unlock } from "lucide-react";

const CATEGORY_LABEL: Record<string, string> = { outlet: "Outlet", kantor: "Kantor" };

type Item = {
  id: number;
  employeeId: number;
  employee: { id: number; name: string; position: string | null; outlet: string | null };
  daysPresent: number;
  overtimeMinutes: number;
  baseSalary: number;
  mealAllowance: number;
  transportReimbursement: number;
  overtimePay: number;
  attendanceDeduction: number;
  bpjsKesehatanDeduction: number;
  bpjsKetenagakerjaanDeduction: number;
  pph21Deduction: number;
  loanDeduction: number;
  otherAdjustment: number;
};
type Period = {
  id: number;
  label: string;
  startDate: string;
  endDate: string;
  category: string;
  status: string;
  items: Item[];
};

const EDITABLE_FIELDS: { key: keyof Item; label: string }[] = [
  { key: "baseSalary", label: "Gaji Pokok" },
  { key: "mealAllowance", label: "Uang Makan" },
  { key: "transportReimbursement", label: "Reimb. Transport" },
  { key: "overtimePay", label: "Lembur (Rp)" },
  { key: "attendanceDeduction", label: "Potongan Absensi" },
  { key: "bpjsKesehatanDeduction", label: "BPJS Kesehatan" },
  { key: "bpjsKetenagakerjaanDeduction", label: "BPJS Ketenagakerjaan" },
  { key: "pph21Deduction", label: "PPh21" },
  { key: "loanDeduction", label: "Kasbon" },
  { key: "otherAdjustment", label: "Penyesuaian Lain" },
];

const DEDUCTION_FIELDS = new Set<keyof Item>([
  "attendanceDeduction",
  "bpjsKesehatanDeduction",
  "bpjsKetenagakerjaanDeduction",
  "pph21Deduction",
  "loanDeduction",
]);

function netPay(item: Item): number {
  let total = 0;
  for (const f of EDITABLE_FIELDS) {
    const v = item[f.key] as number;
    total += DEDUCTION_FIELDS.has(f.key) ? -v : v;
  }
  return total;
}

function formatRupiah(n: number): string {
  return n.toLocaleString("id-ID");
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}j ${m}m`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function PayrollPeriodDetailPage({ params }: { params: Promise<{ category: string; periodId: string }> }) {
  const { category, periodId } = usePromise(params);
  const [period, setPeriod] = useState<Period | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingStatus, setTogglingStatus] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/api/payroll/periods/${periodId}`)
      .then((r) => r.json())
      .then((p: Period) => {
        setPeriod(p);
        setItems(p.items);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [periodId]);

  const isFinal = period?.status === "final";

  function updateLocal(itemId: number, field: keyof Item, value: number) {
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, [field]: value } : it)));
  }

  async function saveItem(itemId: number) {
    const item = items.find((it) => it.id === itemId);
    if (!item) return;
    const body: Record<string, number> = {};
    for (const f of EDITABLE_FIELDS) body[f.key as string] = item[f.key] as number;
    const res = await fetch(`/api/payroll/periods/${periodId}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error("Gagal simpan: " + err.error);
    }
  }

  async function toggleStatus() {
    if (!period) return;
    const nextStatus = period.status === "final" ? "draft" : "final";
    setTogglingStatus(true);
    const res = await fetch(`/api/payroll/periods/${periodId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setTogglingStatus(false);
    if (res.ok) {
      toast.success(nextStatus === "final" ? "Periode difinalisasi." : "Periode dibuka kembali untuk diedit.");
      load();
    } else {
      toast.error("Gagal mengubah status.");
    }
  }

  const categoryLabel = CATEGORY_LABEL[category] ?? category;
  const totalNetPay = items.reduce((sum, it) => sum + netPay(it), 0);

  if (loading) return <p className="text-sm text-muted-foreground">Memuat...</p>;
  if (!period) return <p className="text-sm text-muted-foreground">Periode tidak ditemukan.</p>;

  return (
    <div className="max-w-full grid gap-6">
      <div>
        <Link
          href={`/hr/payroll/${category}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Gaji {categoryLabel}
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-heading font-semibold tracking-tight">{period.label}</h1>
              <Badge variant={isFinal ? "default" : "outline"}>{isFinal ? "Final" : "Draft"}</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              {formatDate(period.startDate)} - {formatDate(period.endDate)} &middot; {items.length} karyawan &middot; Total gaji
              bersih Rp {formatRupiah(totalNetPay)}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={toggleStatus} disabled={togglingStatus} className="shrink-0">
            {isFinal ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {isFinal ? "Buka Kembali" : "Finalisasi"}
          </Button>
        </div>
      </div>

      <Card>
        <div className="thin-scrollbar overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card">Karyawan</TableHead>
                <TableHead>Hadir</TableHead>
                <TableHead>Lembur</TableHead>
                {EDITABLE_FIELDS.map((f) => (
                  <TableHead key={f.key as string} className="whitespace-nowrap">{f.label}</TableHead>
                ))}
                <TableHead className="whitespace-nowrap">Gaji Bersih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4 + EDITABLE_FIELDS.length} className="text-muted-foreground">
                    Tidak ada karyawan aktif di kategori ini.
                  </TableCell>
                </TableRow>
              )}
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="sticky left-0 bg-card font-medium whitespace-nowrap">
                    <Link href={`/hr/karyawan/${item.employeeId}`} className="hover:underline">{item.employee.name}</Link>
                    <p className="text-xs text-muted-foreground font-normal">{item.employee.position || "-"}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">{item.daysPresent}</TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
                    {formatMinutes(item.overtimeMinutes)}
                  </TableCell>
                  {EDITABLE_FIELDS.map((f) => (
                    <TableCell key={f.key as string}>
                      <Input
                        type="number"
                        className="w-28 tabular-nums"
                        value={item[f.key] as number}
                        disabled={isFinal}
                        onChange={(e) => updateLocal(item.id, f.key, Number(e.target.value) || 0)}
                        onBlur={() => saveItem(item.id)}
                      />
                    </TableCell>
                  ))}
                  <TableCell className="font-medium tabular-nums whitespace-nowrap">Rp {formatRupiah(netPay(item))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
