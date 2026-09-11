"use client";

import { useEffect, useMemo, useState, use as usePromise } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Printer, Trash2, Plus } from "lucide-react";
import { calcOutletOvertimeRate, calcOutletLateRate } from "@/lib/payroll-config";
import { EVENT_NOTE_CATEGORIES } from "@/lib/payroll-event-notes";

const CATEGORY_LABEL: Record<string, string> = { outlet: "Outlet", kantor: "Kantor" };

type Employee = {
  id: number;
  name: string;
  position: string | null;
  outlet: string | null;
  dailyTransportRate: number | null;
  dailyMealRate: number | null;
  dailyBaseRate: number | null;
  workSchedule: string | null;
};
type Item = {
  id: number;
  employeeId: number;
  employee: Employee;
  daysPresent: number;
  overtimeMinutes: number;
  [key: string]: unknown;
};
type EventNote = { id: number; employeeId: number; date: string; category: string; amount: number; note: string | null };
type AttendanceRecord = { employeeId: number; date: string; clockIn: string | null; clockOut: string | null };
type Period = {
  id: number;
  label: string;
  startDate: string;
  endDate: string;
  category: string;
  status: string;
  items: Item[];
  eventNotes: EventNote[];
  attendanceRecords: AttendanceRecord[];
};

function formatRupiah(n: number): string {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
}
function formatTimeUTC(iso: string | null) {
  return iso ? iso.slice(11, 16) : "-";
}
function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}j ${m}m`;
}
function dateKeyFromISO(iso: string) {
  return iso.slice(0, 10);
}
function listDatesBetween(startISO: string, endISO: string): string[] {
  const dates: string[] = [];
  const cur = new Date(dateKeyFromISO(startISO));
  const end = new Date(dateKeyFromISO(endISO));
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function EmployeeRincian({
  period,
  item,
  notes,
  records,
  onNoteAdded,
  onNoteDeleted,
}: {
  period: Period;
  item: Item;
  notes: EventNote[];
  records: AttendanceRecord[];
  onNoteAdded: () => void;
  onNoteDeleted: () => void;
}) {
  const [noteDate, setNoteDate] = useState(dateKeyFromISO(period.startDate));
  const [noteCategory, setNoteCategory] = useState<string>(EVENT_NOTE_CATEGORIES[0].key);
  const [noteAmount, setNoteAmount] = useState("");
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  const dailyMealRate = item.employee.dailyMealRate ?? 0;
  const overtimeRate = calcOutletOvertimeRate(dailyMealRate);
  const lateRate = calcOutletLateRate(dailyMealRate);

  const summaryRows = [
    { label: "Gaji Pokok", rate: null as number | null, count: "1", total: (item.baseSalary as number) ?? 0 },
    item.employee.dailyBaseRate != null
      ? { label: "Gaji Part Time", rate: item.employee.dailyBaseRate, count: `${item.daysPresent} hari`, total: (item.partTimePay as number) ?? 0 }
      : null,
    { label: "Uang Transport", rate: item.employee.dailyTransportRate, count: `${item.daysPresent} hari`, total: (item.transportReimbursement as number) ?? 0 },
    { label: "Uang Makan", rate: item.employee.dailyMealRate, count: `${item.daysPresent} hari`, total: (item.mealAllowance as number) ?? 0 },
    { label: "Lembur", rate: Math.round(overtimeRate), count: formatMinutes(item.overtimeMinutes), total: (item.overtimePay as number) ?? 0 },
    { label: "Keterlambatan", rate: Math.round(lateRate), count: `${(item.lateCount as number) ?? 0} kali`, total: (item.lateDeduction as number) ?? 0 },
    { label: "Pengurangan Dari Kejadian", rate: null, count: `${notes.filter((n) => n.category === "kejadian").length} kejadian`, total: (item.incidentDeduction as number) ?? 0 },
    { label: "Pemotongan SP", rate: null, count: `${notes.filter((n) => n.category === "sp").length} kali`, total: (item.warningLetterDeduction as number) ?? 0 },
    { label: "Bayar Deposit", rate: null, count: "-", total: (item.depositDeduction as number) ?? 0 },
    { label: "Kembali Deposit", rate: null, count: "-", total: (item.depositRefund as number) ?? 0 },
    { label: "Service Charge", rate: null, count: "-", total: (item.serviceCharge as number) ?? 0 },
    { label: "Bonus", rate: null, count: "-", total: (item.bonus as number) ?? 0 },
    { label: "Penyesuaian Lain", rate: null, count: "-", total: (item.otherAdjustment as number) ?? 0 },
  ].filter((r): r is NonNullable<typeof r> => r != null && r.total !== 0);

  const dates = useMemo(() => listDatesBetween(period.startDate, period.endDate), [period.startDate, period.endDate]);

  async function addNote() {
    const amount = Number(noteAmount.replace(/\D/g, ""));
    if (!noteDate || !amount) {
      toast.error("Tanggal dan jumlah wajib diisi");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/payroll/periods/${period.id}/items/${item.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: noteDate, category: noteCategory, amount, note: noteText }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json();
      toast.error("Gagal simpan catatan: " + err.error);
      return;
    }
    setNoteAmount("");
    setNoteText("");
    toast.success("Catatan disimpan.");
    onNoteAdded();
  }

  async function deleteNote(noteId: number) {
    const res = await fetch(`/api/payroll/periods/${period.id}/items/${item.id}/notes/${noteId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Gagal hapus catatan");
      return;
    }
    onNoteDeleted();
  }

  const isFinal = period.status === "final";

  return (
    <Card className="print:break-inside-avoid print:border-0 print:shadow-none">
      <CardHeader>
        <CardTitle className="text-base">{item.employee.name}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {[item.employee.position, item.employee.outlet].filter(Boolean).join(" · ") || "-"}
          {item.employee.workSchedule ? ` · Jadwal ${item.employee.workSchedule}` : ""}
        </p>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-1.5 pr-2 font-medium">Jenis</th>
                <th className="py-1.5 pr-2 font-medium">Rate</th>
                <th className="py-1.5 pr-2 font-medium">Kehadiran</th>
                <th className="py-1.5 pr-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.length === 0 && (
                <tr><td colSpan={4} className="py-2 text-muted-foreground">Belum ada komponen gaji.</td></tr>
              )}
              {summaryRows.map((r) => (
                <tr key={r.label} className="border-b last:border-0">
                  <td className="py-1.5 pr-2">{r.label}</td>
                  <td className="py-1.5 pr-2 tabular-nums text-muted-foreground">{r.rate != null ? formatRupiah(r.rate) : "-"}</td>
                  <td className="py-1.5 pr-2 tabular-nums text-muted-foreground">{r.count}</td>
                  <td className={`py-1.5 pr-2 tabular-nums text-right font-medium ${r.total < 0 ? "text-destructive" : ""}`}>
                    {formatRupiah(r.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto thin-scrollbar max-h-72 print:max-h-none">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-card print:static">
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-1.5 pr-2 font-medium whitespace-nowrap">Tanggal</th>
                <th className="py-1.5 pr-2 font-medium whitespace-nowrap">Jam Masuk</th>
                <th className="py-1.5 pr-2 font-medium whitespace-nowrap">Jam Pulang</th>
                <th className="py-1.5 pr-2 font-medium">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {dates.map((d) => {
                const record = records.find((r) => r.date === d);
                const dayNotes = notes.filter((n) => dateKeyFromISO(n.date) === d);
                return (
                  <tr key={d} className="border-b last:border-0">
                    <td className="py-1 pr-2 whitespace-nowrap">{formatDateShort(d)}</td>
                    <td className="py-1 pr-2 tabular-nums text-muted-foreground">{formatTimeUTC(record?.clockIn ?? null)}</td>
                    <td className="py-1 pr-2 tabular-nums text-muted-foreground">{formatTimeUTC(record?.clockOut ?? null)}</td>
                    <td className="py-1 pr-2 text-xs">
                      {dayNotes.length === 0
                        ? ""
                        : dayNotes.map((n) => (
                            <span key={n.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 mr-1 mb-0.5">
                              {EVENT_NOTE_CATEGORIES.find((c) => c.key === n.category)?.label ?? n.category} {formatRupiah(n.amount)}
                              {n.note ? ` - ${n.note}` : ""}
                              {!isFinal && (
                                <button type="button" onClick={() => deleteNote(n.id)} className="text-muted-foreground hover:text-destructive">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </span>
                          ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!isFinal && (
          <div className="no-print flex flex-wrap items-end gap-2 border-t pt-4">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Tanggal</label>
              <Input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} className="w-36" />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Kategori</label>
              <Select value={noteCategory} onValueChange={(v) => v && setNoteCategory(v)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_NOTE_CATEGORIES.map((c) => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Jumlah (Rp)</label>
              <Input value={noteAmount} onChange={(e) => setNoteAmount(e.target.value)} className="w-32" placeholder="15000" />
            </div>
            <div className="grid gap-1 flex-1 min-w-40">
              <label className="text-xs text-muted-foreground">Keterangan</label>
              <Input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="mis. Hekeng Rusak" />
            </div>
            <Button size="sm" onClick={addNote} disabled={saving}>
              <Plus className="h-3.5 w-3.5" /> Catat
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
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
          <EmployeeRincian
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
