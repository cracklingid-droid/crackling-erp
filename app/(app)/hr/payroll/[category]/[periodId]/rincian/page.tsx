"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { EmployeeRincianCard, type RincianItem, type RincianNote } from "@/components/payroll/employee-rincian-card";

const CATEGORY_LABEL: Record<string, string> = { outlet: "Outlet", kantor: "Kantor" };

type AttendanceRecord = { employeeId: number; date: string; clockIn: string | null; clockOut: string | null };
type Period = {
  id: number;
  label: string;
  startDate: string;
  endDate: string;
  category: string;
  status: string;
  items: RincianItem[];
  eventNotes: RincianNote[];
  attendanceRecords: AttendanceRecord[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function RincianPerhitunganPage({ params }: { params: Promise<{ category: string; periodId: string }> }) {
  const { category, periodId } = usePromise(params);
  const [period, setPeriod] = useState<Period | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  function load() {
    setLoading(true);
    fetch(`/api/payroll/periods/${periodId}/rincian`)
      .then((r) => r.json())
      .then(setPeriod)
      .finally(() => setLoading(false));
  }

  useEffect(load, [periodId]);

  const categoryLabel = CATEGORY_LABEL[category] ?? category;
  const filteredItems = period?.items.filter((it) => it.employee.name.toLowerCase().includes(search.toLowerCase())) ?? [];

  if (loading) return <p className="text-sm text-muted-foreground">Memuat...</p>;
  if (!period) return <p className="text-sm text-muted-foreground">Periode tidak ditemukan.</p>;

  return (
    <div className="max-w-4xl mx-auto grid gap-6">
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print">
        <Link
          href={`/hr/payroll/${category}/${periodId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Periode Gaji
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-heading font-semibold tracking-tight">Rincian Perhitungan - {categoryLabel}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {period.label} &middot; {formatDate(period.startDate)} - {formatDate(period.endDate)}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print / Simpan PDF
          </Button>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama karyawan..."
          className="mt-4 max-w-xs"
        />
      </div>

      <div className="grid gap-5">
        {filteredItems.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada karyawan yang cocok.</p>}
        {filteredItems.map((item) => (
          <EmployeeRincianCard
            key={item.id}
            period={period}
            item={item}
            notes={period.eventNotes.filter((n) => n.employeeId === item.employeeId)}
            records={period.attendanceRecords.filter((r) => r.employeeId === item.employeeId)}
            onNoteAdded={load}
            onNoteDeleted={load}
          />
        ))}
      </div>
    </div>
  );
}
