"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { DEDUCTION_FIELD_KEYS, fieldsForCategory, computeNetPay } from "@/lib/payroll-fields";

const CATEGORY_LABEL: Record<string, string> = { outlet: "Outlet", kantor: "Kantor" };

type Item = {
  id: number;
  employeeId: number;
  employee: { id: number; name: string; position: string | null; outlet: string | null };
  daysPresent: number;
  overtimeMinutes: number;
  [key: string]: unknown;
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

function formatRupiah(n: number): string {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function PayrollSlipPage({ params }: { params: Promise<{ category: string; periodId: string; itemId: string }> }) {
  const { category, periodId, itemId } = usePromise(params);
  const [period, setPeriod] = useState<Period | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/payroll/periods/${periodId}`)
      .then((r) => r.json())
      .then(setPeriod)
      .finally(() => setLoading(false));
  }, [periodId]);

  if (loading) return <p className="text-sm text-muted-foreground">Memuat...</p>;
  const item = period?.items.find((it) => it.id === Number(itemId));
  if (!period || !item) return <p className="text-sm text-muted-foreground">Data slip gaji tidak ditemukan.</p>;

  const categoryLabel = CATEGORY_LABEL[category] ?? category;
  const editableFields = fieldsForCategory(category);
  const earningFields = editableFields.filter((f) => !DEDUCTION_FIELD_KEYS.has(f.key) && f.key !== "otherAdjustment");
  const deductionFields = editableFields.filter((f) => DEDUCTION_FIELD_KEYS.has(f.key));
  const otherAdjustment = (item.otherAdjustment as number) ?? 0;

  const nonZeroEarnings = earningFields.filter((f) => ((item[f.key] as number) ?? 0) !== 0);
  const nonZeroDeductions = deductionFields.filter((f) => ((item[f.key] as number) ?? 0) !== 0);

  const totalEarnings = nonZeroEarnings.reduce((s, f) => s + ((item[f.key] as number) ?? 0), 0) + Math.max(0, otherAdjustment);
  const totalDeductions = nonZeroDeductions.reduce((s, f) => s + ((item[f.key] as number) ?? 0), 0) + Math.max(0, -otherAdjustment);
  const netPay = computeNetPay(item as unknown as Record<string, number>, editableFields);

  const baseSalary = (item.baseSalary as number) ?? 0;
  const showTransferSplit = category === "outlet";
  const transfer2 = netPay - baseSalary;

  return (
    <div className="max-w-2xl mx-auto">
      <style>{`
        @page { size: A4; margin: 16mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between mb-4">
        <Link
          href={`/hr/payroll/${category}/${periodId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Periode Gaji
        </Link>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" /> Download PDF
        </Button>
      </div>

      <div className="rounded-2xl border bg-card p-8 print:border-0 print:rounded-none print:p-0">
        <div className="flex items-start justify-between border-b pb-4 mb-4">
          <div>
            <p className="font-heading font-bold text-lg tracking-wide">CRACKLING</p>
            <p className="text-sm text-muted-foreground">Slip Gaji {categoryLabel}</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>{period.label}</p>
            <p>
              {formatDate(period.startDate)} - {formatDate(period.endDate)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="text-muted-foreground">Nama Karyawan</p>
            <p className="font-medium">{item.employee.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Jabatan</p>
            <p className="font-medium">{item.employee.position || "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Outlet/Cabang</p>
            <p className="font-medium">{item.employee.outlet || "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Hari Hadir</p>
            <p className="font-medium">{item.daysPresent} hari</p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 mb-6">
          <div>
            <p className="text-sm font-semibold border-b pb-1 mb-2">Penghasilan</p>
            {nonZeroEarnings.length === 0 && otherAdjustment <= 0 ? (
              <p className="text-sm text-muted-foreground">-</p>
            ) : (
              <div className="grid gap-1 text-sm">
                {nonZeroEarnings.map((f) => (
                  <div key={f.key} className="flex justify-between">
                    <span className="text-muted-foreground">{f.label}</span>
                    <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{formatRupiah(item[f.key] as number)}</span>
                  </div>
                ))}
                {otherAdjustment > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Penyesuaian Lain</span>
                    <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{formatRupiah(otherAdjustment)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold border-b pb-1 mb-2">Potongan</p>
            {nonZeroDeductions.length === 0 && otherAdjustment >= 0 ? (
              <p className="text-sm text-muted-foreground">-</p>
            ) : (
              <div className="grid gap-1 text-sm">
                {nonZeroDeductions.map((f) => (
                  <div key={f.key} className="flex justify-between">
                    <span className="text-muted-foreground">{f.label}</span>
                    <span className="tabular-nums text-red-600 dark:text-red-400">{formatRupiah(item[f.key] as number)}</span>
                  </div>
                ))}
                {otherAdjustment < 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Penyesuaian Lain</span>
                    <span className="tabular-nums text-red-600 dark:text-red-400">{formatRupiah(-otherAdjustment)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-1 text-sm border-t pt-3 mb-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Penghasilan</span>
            <span className="tabular-nums">{formatRupiah(totalEarnings)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Potongan</span>
            <span className="tabular-nums">{formatRupiah(totalDeductions)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold border-t pt-2 mt-1">
            <span>Gaji Bersih</span>
            <span className="tabular-nums">{formatRupiah(netPay)}</span>
          </div>
        </div>

        {showTransferSplit && (
          <div className="grid gap-1 text-sm border-t pt-3">
            <p className="text-sm font-semibold mb-1">Rincian Transfer</p>
            {baseSalary > 0 ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transfer 1 (Tgl 10) - Gaji Pokok</span>
                  <span className="tabular-nums">{formatRupiah(baseSalary)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transfer 2 (Tgl 25) - Sisa Penghasilan</span>
                  <span className="tabular-nums">{formatRupiah(transfer2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transfer (Tgl 25)</span>
                <span className="tabular-nums">{formatRupiah(netPay)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
