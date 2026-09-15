"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Undo2 } from "lucide-react";
import {
  ATTENDANCE_ISSUE_LABELS,
  ISSUE_RESOLUTION_LABELS,
  ISSUE_RESOLUTION_STATUSES,
  SINGLE_SCAN_CUTOFF_HOUR,
  notifyAttendanceIssuesChanged,
  type AttendanceIssueType,
  type IssueResolutionStatus,
} from "@/lib/attendance-issue-types";

type Issue = {
  employeeId: number;
  employeeName: string;
  outlet: string | null;
  date: string;
  type: AttendanceIssueType;
  clockIn: string | null;
  clockOut: string | null;
  resolution: { status: IssueResolutionStatus; note: string | null; resolvedByName: string | null; resolvedAt: string } | null;
};

// "YYYY-MM-DD" di-parse sbg tanggal lokal (bukan new Date(string) yang
// dianggap UTC) supaya tidak geser 1 hari di zona waktu browser.
function formatDateID(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function issueKey(issue: Issue) {
  return `${issue.employeeId}|${issue.date}|${issue.type}`;
}

function ScanCell({ issue }: { issue: Issue }) {
  if (issue.type === "tidak_absen") {
    return <span className="text-muted-foreground">Tidak ada scan (roster: masuk)</span>;
  }
  const scan = issue.type === "lupa_tap_out" ? issue.clockIn : issue.clockOut;
  return (
    <span className="tabular-nums">
      {scan ?? "-"}{" "}
      <span className="text-muted-foreground">{issue.type === "lupa_tap_out" ? "(dianggap jam masuk)" : "(dianggap jam pulang)"}</span>
    </span>
  );
}

// Daftar absen bermasalah (lupa tap in/out & tidak absen menurut Roster
// Kerja) - HR isi jam manual atau tandai izin/sakit/cuti/diabaikan.
// Dibuka dari lonceng header & hasil upload absen. Permintaan 2026-09-15.
export default function AbsenPerluDicekPage() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [includeResolved, setIncludeResolved] = useState(false);
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [manualTarget, setManualTarget] = useState<Issue | null>(null);
  const [manualIn, setManualIn] = useState("");
  const [manualOut, setManualOut] = useState("");
  const [manualNote, setManualNote] = useState("");

  const [resolveTarget, setResolveTarget] = useState<Issue | null>(null);
  const [resolveStatus, setResolveStatus] = useState<IssueResolutionStatus>("izin");
  const [resolveNote, setResolveNote] = useState("");

  const [saving, setSaving] = useState(false);

  // Sengaja tidak setLoading(true) di sini - fungsi ini juga dipanggil dari
  // effect saat halaman dibuka (loading awal sudah true), & setState sinkron
  // di dalam effect dilarang lint react-hooks. Pemanggil lain (tombol
  // Tampilkan/checkbox) set loading sendiri.
  function load(params: { start: string; end: string; includeResolved: boolean }) {
    const qs = new URLSearchParams();
    if (params.start) qs.set("start", params.start);
    if (params.end) qs.set("end", params.end);
    if (params.includeResolved) qs.set("includeResolved", "1");
    fetch(`/api/payroll/attendance/issues?${qs}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          toast.error("Gagal memuat: " + data.error);
          return;
        }
        setIssues(data.issues);
        setStart(data.start);
        setEnd(data.end);
      })
      .finally(() => setLoading(false));
  }

  // Rentang tanggal awal boleh dikirim lewat URL (dari link hasil upload
  // absen) - dibaca langsung dari window.location, bukan useSearchParams,
  // supaya halaman tidak perlu dibungkus Suspense.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    load({ start: params.get("start") ?? "", end: params.get("end") ?? "", includeResolved: false });
  }, []);

  function reload(nextIncludeResolved = includeResolved) {
    setLoading(true);
    load({ start, end, includeResolved: nextIncludeResolved });
  }

  function openManual(issue: Issue) {
    setManualTarget(issue);
    setManualIn(issue.type === "lupa_tap_out" ? issue.clockIn ?? "" : "");
    setManualOut(issue.type === "lupa_tap_in" ? issue.clockOut ?? "" : "");
    setManualNote("");
  }

  function openResolve(issue: Issue) {
    setResolveTarget(issue);
    setResolveStatus(issue.resolution?.status ?? "izin");
    setResolveNote(issue.resolution?.note ?? "");
  }

  async function saveManual() {
    if (!manualTarget) return;
    if (!manualIn || !manualOut) {
      toast.error("Jam masuk & jam pulang wajib diisi");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/payroll/attendance/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: manualTarget.employeeId,
        date: manualTarget.date,
        clockIn: manualIn,
        clockOut: manualOut,
        note: manualNote,
      }),
    });
    setSaving(false);
    const data = await res.json();
    if (!res.ok) {
      toast.error("Gagal simpan: " + data.error);
      return;
    }
    toast.success(`Absen ${manualTarget.employeeName} ${formatDateID(manualTarget.date)} disimpan.`);
    if (data.recalculatedPeriods?.length > 0) {
      toast.success(`Gaji Outlet otomatis dihitung ulang: ${data.recalculatedPeriods.join(", ")}.`);
    }
    if (data.finalPeriods?.length > 0) {
      toast.warning(`Periode ${data.finalPeriods.join(", ")} sudah final - gajinya tidak ikut berubah.`);
    }
    setManualTarget(null);
    reload();
    notifyAttendanceIssuesChanged();
  }

  async function saveResolve() {
    if (!resolveTarget) return;
    setSaving(true);
    const res = await fetch("/api/payroll/attendance/issues/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: resolveTarget.employeeId,
        date: resolveTarget.date,
        issueType: resolveTarget.type,
        status: resolveStatus,
        note: resolveNote,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json();
      toast.error("Gagal simpan: " + err.error);
      return;
    }
    toast.success(`Ditandai ${ISSUE_RESOLUTION_LABELS[resolveStatus]}.`);
    setResolveTarget(null);
    reload();
    notifyAttendanceIssuesChanged();
  }

  async function undoResolve(issue: Issue) {
    const qs = new URLSearchParams({ employeeId: String(issue.employeeId), date: issue.date, issueType: issue.type });
    const res = await fetch(`/api/payroll/attendance/issues/resolve?${qs}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Gagal membatalkan tanda");
      return;
    }
    toast.success("Tanda dibatalkan - masalah muncul lagi di lonceng.");
    reload();
    notifyAttendanceIssuesChanged();
  }

  const open = issues?.filter((i) => !i.resolution) ?? [];
  const countByType = (type: AttendanceIssueType) => open.filter((i) => i.type === type).length;

  return (
    <div className="max-w-5xl grid gap-6">
      <div>
        <Link href="/hr/payroll/absensi" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Upload Absensi
        </Link>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Absen Perlu Dicek</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Karyawan yang lupa tap in/out atau tidak absen. Scan tunggal sebelum jam {SINGLE_SCAN_CUTOFF_HOUR}:00 dianggap jam masuk
          (lupa tap out), sesudahnya dianggap jam pulang (lupa tap in). &quot;Tidak absen&quot; = jadwal Roster Kerja
          &quot;Masuk&quot; tapi tidak ada scan sama sekali, cuma dicek untuk tanggal yang data absen outletnya sudah diupload.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="issues-start">Dari Tanggal</Label>
            <Input id="issues-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-auto" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="issues-end">Sampai Tanggal</Label>
            <Input id="issues-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-auto" />
          </div>
          <label className="flex h-8 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeResolved}
              onChange={(e) => {
                setIncludeResolved(e.target.checked);
                load({ start, end, includeResolved: e.target.checked });
              }}
              className="h-4 w-4 accent-primary"
            />
            Tampilkan yang sudah ditandai
          </label>
          <Button onClick={() => reload()} disabled={loading}>
            {loading ? "Memuat..." : "Tampilkan"}
          </Button>
        </CardContent>
      </Card>

      {issues && (
        <div className="flex flex-wrap gap-2 text-sm">
          {(["lupa_tap_in", "lupa_tap_out", "tidak_absen"] as const).map((type) => (
            <Badge key={type} variant={type === "tidak_absen" ? "destructive" : "outline"}>
              {ATTENDANCE_ISSUE_LABELS[type]}: {countByType(type)}
            </Badge>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {issues ? `${open.length} absen belum ditangani` : "Memuat..."}
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Masalah</TableHead>
                <TableHead>Scan Tercatat</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Tidak ada absen bermasalah di
                      rentang tanggal ini.
                    </span>
                  </TableCell>
                </TableRow>
              )}
              {issues?.map((issue) => (
                <TableRow key={issueKey(issue)} className={issue.resolution ? "opacity-60" : undefined}>
                  <TableCell className="whitespace-nowrap">{formatDateID(issue.date)}</TableCell>
                  <TableCell>
                    <Link href={`/hr/karyawan/${issue.employeeId}`} className="font-medium hover:underline">
                      {issue.employeeName}
                    </Link>
                    {issue.outlet && <div className="text-xs text-muted-foreground">{issue.outlet}</div>}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={issue.type === "tidak_absen" ? "destructive" : "outline"}
                      className={issue.type === "tidak_absen" ? undefined : "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"}
                    >
                      {ATTENDANCE_ISSUE_LABELS[issue.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    <ScanCell issue={issue} />
                  </TableCell>
                  <TableCell className="text-right">
                    {issue.resolution ? (
                      <div className="flex items-center justify-end gap-2 text-xs">
                        <span>
                          <span className="font-medium">{ISSUE_RESOLUTION_LABELS[issue.resolution.status]}</span>
                          {issue.resolution.resolvedByName && (
                            <span className="text-muted-foreground"> · {issue.resolution.resolvedByName}</span>
                          )}
                          {issue.resolution.note && <span className="text-muted-foreground"> · {issue.resolution.note}</span>}
                        </span>
                        <Button size="xs" variant="ghost" onClick={() => undoResolve(issue)}>
                          <Undo2 className="h-3 w-3" /> Batalkan
                        </Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1.5">
                        <Button size="xs" onClick={() => openManual(issue)}>
                          Isi Manual
                        </Button>
                        <Button size="xs" variant="outline" onClick={() => openResolve(issue)}>
                          Izin/Sakit/Abaikan
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!manualTarget} onOpenChange={(isOpen) => !isOpen && setManualTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Isi Absen Manual</DialogTitle>
            <DialogDescription>
              {manualTarget ? `${manualTarget.employeeName} · ${formatDateID(manualTarget.date)} · ${ATTENDANCE_ISSUE_LABELS[manualTarget.type]}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="manual-in">Jam Masuk</Label>
                <Input id="manual-in" type="time" value={manualIn} onChange={(e) => setManualIn(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="manual-out">Jam Pulang</Label>
                <Input id="manual-out" type="time" value={manualOut} onChange={(e) => setManualOut(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="manual-note">Catatan (opsional)</Label>
              <Textarea
                id="manual-note"
                rows={2}
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="mis. lupa scan pulang, dikonfirmasi SPV"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualTarget(null)}>
              Batal
            </Button>
            <Button onClick={saveManual} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Absen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resolveTarget} onOpenChange={(isOpen) => !isOpen && setResolveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tandai Tanpa Isi Jam</DialogTitle>
            <DialogDescription>
              {resolveTarget ? `${resolveTarget.employeeName} · ${formatDateID(resolveTarget.date)} · ${ATTENDANCE_ISSUE_LABELS[resolveTarget.type]}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={resolveStatus} onValueChange={(v) => v && setResolveStatus(v as IssueResolutionStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{() => ISSUE_RESOLUTION_LABELS[resolveStatus]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_RESOLUTION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {ISSUE_RESOLUTION_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="resolve-note">Catatan (opsional)</Label>
              <Textarea
                id="resolve-note"
                rows={2}
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="mis. sakit, ada surat dokter"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)}>
              Batal
            </Button>
            <Button onClick={saveResolve} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
