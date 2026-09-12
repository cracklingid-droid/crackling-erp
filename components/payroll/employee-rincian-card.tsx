"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { calcOutletOvertimeRate, calcOutletLateRate } from "@/lib/payroll-config";
import { EVENT_NOTE_CATEGORIES } from "@/lib/payroll-event-notes";
import { computeEmployeeDailyDetail, type DailyDetailAttendance } from "@/lib/payroll-daily-detail";

export type RincianNote = { id: number; employeeId: number; date: string; category: string; amount: number; note: string | null };

export type RincianEmployee = {
  id: number;
  name: string;
  position: string | null;
  outlet: string | null;
  baseSalary: number | null;
  dailyTransportRate: number | null;
  dailyMealRate: number | null;
  dailyBaseRate: number | null;
  workSchedule: string | null;
};
export type RincianItem = {
  id: number;
  employeeId: number;
  employee: RincianEmployee;
  daysPresent: number;
  overtimeMinutes: number;
  [key: string]: unknown;
};
export type RincianPeriod = {
  id: number;
  startDate: string;
  endDate: string;
  status: string;
};

function formatRupiah(n: number): string {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}
function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
}
function formatMinutes(min: number): string {
  if (min <= 0) return "-";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}j ${m}m`;
}
function dateKeyFromISO(iso: string) {
  return iso.slice(0, 10);
}

export function EmployeeRincianCard({
  period,
  item,
  notes,
  records,
  onNoteAdded,
  onNoteDeleted,
}: {
  period: RincianPeriod;
  item: RincianItem;
  notes: RincianNote[];
  records: DailyDetailAttendance[];
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
  const isPartTime = item.employee.dailyBaseRate != null;

  const summaryRows = [
    { label: "Gaji Pokok", rate: null as number | null, count: "1", total: (item.baseSalary as number) ?? 0 },
    isPartTime
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

  const daily = useMemo(
    () =>
      computeEmployeeDailyDetail(
        {
          daysPresent: item.daysPresent,
          baseSalary: (item.baseSalary as number) ?? 0,
          partTimePay: (item.partTimePay as number) ?? 0,
          overtimePay: (item.overtimePay as number) ?? 0,
          incidentDeduction: (item.incidentDeduction as number) ?? 0,
          warningLetterDeduction: (item.warningLetterDeduction as number) ?? 0,
          lateDeduction: (item.lateDeduction as number) ?? 0,
          employee: item.employee,
        },
        period.startDate,
        period.endDate,
        notes,
        records
      ),
    [item, period.startDate, period.endDate, notes, records]
  );

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

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Detail Harian - biaya dibebankan di tanggal karyawan benar-benar hadir</p>
          <div className="overflow-x-auto thin-scrollbar max-h-96 print:max-h-none">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-card print:static">
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-1.5 pr-2 font-medium whitespace-nowrap">Tanggal</th>
                  <th className="py-1.5 pr-2 font-medium whitespace-nowrap">Masuk</th>
                  <th className="py-1.5 pr-2 font-medium whitespace-nowrap">Pulang</th>
                  <th className="py-1.5 pr-2 font-medium text-right whitespace-nowrap">Gaji Pokok</th>
                  {isPartTime && <th className="py-1.5 pr-2 font-medium text-right whitespace-nowrap">Part Time</th>}
                  <th className="py-1.5 pr-2 font-medium text-right whitespace-nowrap">Uang Makan</th>
                  <th className="py-1.5 pr-2 font-medium text-right whitespace-nowrap">Transport</th>
                  <th className="py-1.5 pr-2 font-medium text-right whitespace-nowrap">Lembur</th>
                  <th className="py-1.5 pr-2 font-medium text-right whitespace-nowrap">Potongan</th>
                  <th className="py-1.5 pr-2 font-medium">Keterangan</th>
                  <th className="py-1.5 pr-2 font-medium text-right whitespace-nowrap">Total Hari Ini</th>
                </tr>
              </thead>
              <tbody>
                {daily.rows.map((r) => {
                  const potongan = r.potonganKejadian + r.potonganSP + r.potonganTelat;
                  const dayNotes = notes.filter((n) => dateKeyFromISO(n.date) === r.date);
                  return (
                    <tr key={r.date} className={`border-b last:border-0 ${!r.hadir ? "text-muted-foreground/70" : ""}`}>
                      <td className="py-1 pr-2 whitespace-nowrap">{formatDateShort(r.date)}</td>
                      <td className="py-1 pr-2 tabular-nums text-muted-foreground">{r.clockIn ?? "-"}</td>
                      <td className="py-1 pr-2 tabular-nums text-muted-foreground">{r.clockOut ?? "-"}</td>
                      <td className="py-1 pr-2 tabular-nums text-right">{r.hadir ? formatRupiah(r.gajiPokok) : "-"}</td>
                      {isPartTime && <td className="py-1 pr-2 tabular-nums text-right">{r.hadir ? formatRupiah(r.gajiPartTime) : "-"}</td>}
                      <td className="py-1 pr-2 tabular-nums text-right">{r.hadir ? formatRupiah(r.uangMakan) : "-"}</td>
                      <td className="py-1 pr-2 tabular-nums text-right">{r.hadir ? formatRupiah(r.uangTransport) : "-"}</td>
                      <td className="py-1 pr-2 tabular-nums text-right">
                        {r.lembur > 0 ? (
                          <>
                            {formatRupiah(r.lembur)}
                            <span className="block text-[10px] text-muted-foreground">{formatMinutes(r.overtimeMinutes)}</span>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className={`py-1 pr-2 tabular-nums text-right ${potongan > 0 ? "text-destructive" : ""}`}>
                        {potongan > 0 ? `-${formatRupiah(potongan)}` : "-"}
                      </td>
                      <td className="py-1 pr-2 text-xs">
                        {dayNotes.map((n) => (
                          <span key={n.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 mr-1 mb-0.5">
                            {EVENT_NOTE_CATEGORIES.find((c) => c.key === n.category)?.label ?? n.category}
                            {n.note ? ` - ${n.note}` : ""}
                            {!isFinal && (
                              <button type="button" onClick={() => deleteNote(n.id)} className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </span>
                        ))}
                      </td>
                      <td className="py-1 pr-2 tabular-nums text-right font-medium">{r.hadir || potongan > 0 ? formatRupiah(r.net) : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
              {daily.adjustments.length > 0 && (
                <tfoot>
                  {daily.adjustments.map((a, i) => (
                    <tr key={i} className="border-t text-xs text-muted-foreground">
                      <td colSpan={isPartTime ? 10 : 9} className="py-1 pr-2">{a.label}</td>
                      <td className={`py-1 pr-2 tabular-nums text-right ${a.amount < 0 ? "text-destructive" : ""}`}>{formatRupiah(a.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t font-medium">
                    <td colSpan={isPartTime ? 10 : 9} className="py-1.5 pr-2">Total dari Detail Harian</td>
                    <td className="py-1.5 pr-2 tabular-nums text-right">{formatRupiah(daily.totalFromDaily)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            BPJS, PPh21, Kasbon, Bayar/Kembali Deposit, Bonus, Service Charge &amp; Penyesuaian Lain tidak tercatat per
            tanggal kejadian - tetap dihitung sebagai komponen bulanan di tabel Jenis di atas / Rekap Bulanan.
          </p>
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
