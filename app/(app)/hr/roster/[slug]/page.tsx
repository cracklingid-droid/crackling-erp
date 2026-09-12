"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { slugToOutlet, addWeeks, dateKey, formatDayLabel } from "@/lib/roster";

type RosterData = {
  outlet: string;
  days: string[];
  employees: { id: number; name: string; defaultOffDays: number[] }[];
  entries: { employeeId: number; date: string; isWorking: boolean }[];
};

function valueToOption(v: boolean | undefined): string {
  return v === true ? "masuk" : v === false ? "libur" : "kosong";
}

function optionToValue(o: string): boolean | null {
  return o === "masuk" ? true : o === "libur" ? false : null;
}

// Outlet resto (bukan Central Kitchen) selalu ramai di akhir pekan - default
// Sabtu & Minggu "Masuk" utk semua karyawan, beda dari pola "Hari Libur
// Rutin" per-karyawan yang cuma berlaku kalau memang diisi HR. Kalau
// karyawan itu justru punya pola eksplisit yang menandai Sabtu/Minggu
// sebagai hari liburnya, pola pribadinya itu yang menang (lebih spesifik).
// Permintaan Kevin 2026-09-12.
const WEEKEND_MASUK_OUTLETS = ["Gading Serpong", "Kelapa Gading", "Fatgai"];
const WEEKEND_DAYS = [0, 6]; // Minggu, Sabtu

export default function RosterOutletPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = usePromise(params);
  const outlet = slugToOutlet(slug);
  const [anchor, setAnchor] = useState(new Date());
  const [data, setData] = useState<RosterData | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!outlet) return;
    setLoading(true);
    fetch(`/api/roster?outlet=${encodeURIComponent(outlet)}&weekStart=${dateKey(anchor)}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(load, [outlet, anchor.getTime()]);

  // Otomatis isi Masuk/Libur tiap buka minggu baru, sesuai pola "Hari Libur
  // Rutin" yang diatur per karyawan di Database Karyawan - cuma isi sel yang
  // masih kosong (kosong -> belum diatur), tidak pernah menimpa yang sudah
  // eksplisit diisi HR. Karyawan tanpa pola (defaultOffDays kosong) tetap
  // kosong seperti biasa. Permintaan Kevin 2026-09-11.
  const backfilledWeekRef = useRef<string | null>(null);
  useEffect(() => {
    if (!data) return;
    const weekKey = `${data.outlet}-${data.days[0]}`;
    if (backfilledWeekRef.current === weekKey) return;
    backfilledWeekRef.current = weekKey;

    const weekendMasuk = WEEKEND_MASUK_OUTLETS.includes(data.outlet);

    for (const emp of data.employees) {
      const offDays = emp.defaultOffDays ?? [];
      for (const d of data.days) {
        const hasEntry = data.entries.some((e) => e.employeeId === emp.id && e.date === d);
        if (hasEntry) continue;
        const dayOfWeek = new Date(d).getDay();

        if (weekendMasuk && WEEKEND_DAYS.includes(dayOfWeek) && !offDays.includes(dayOfWeek)) {
          setCell(emp.id, d, true);
          continue;
        }
        if (offDays.length > 0) {
          setCell(emp.id, d, !offDays.includes(dayOfWeek));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function setCell(employeeId: number, date: string, next: boolean | null) {
    // update optimis di UI
    setData((d) => {
      if (!d) return d;
      const rest = d.entries.filter((e) => !(e.employeeId === employeeId && e.date === date));
      return { ...d, entries: next === null ? rest : [...rest, { employeeId, date, isWorking: next }] };
    });
    const res = await fetch("/api/roster", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, date, isWorking: next }),
    });
    if (!res.ok) {
      toast.error("Gagal menyimpan, mencoba muat ulang...");
      load();
    }
  }

  if (!outlet) return <p className="text-sm text-muted-foreground">Outlet tidak ditemukan.</p>;

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/roster/${slug}` : `/roster/${slug}`;

  return (
    <div className="max-w-4xl grid gap-6">
      <div>
        <Link href="/hr/roster" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Roster Kerja
        </Link>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Roster - {outlet}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Pilih status Masuk/Libur tiap karyawan lewat dropdown di bawah.
          {outlet && WEEKEND_MASUK_OUTLETS.includes(outlet) && (
            <> Sabtu &amp; Minggu otomatis "Masuk" (resto ramai akhir pekan), kecuali karyawan itu punya pola libur pribadi di hari itu.</>
          )}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setAnchor((a) => addWeeks(a, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              {data ? `${formatDayLabel(new Date(data.days[0]))} - ${formatDayLabel(new Date(data.days[6]))}` : "..."}
            </span>
            <Button variant="outline" size="icon" onClick={() => setAnchor((a) => addWeeks(a, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(publicUrl);
              toast.success("Link roster disalin.");
            }}
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Copy className="h-3.5 w-3.5" /> Salin link untuk karyawan
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jadwal Seminggu</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading || !data ? (
            <p className="text-sm text-muted-foreground">Memuat...</p>
          ) : data.employees.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada karyawan aktif di outlet ini.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left font-medium px-2 py-2 sticky left-0 bg-card">Karyawan</th>
                  {data.days.map((d) => (
                    <th key={d} className="text-center font-medium px-2 py-2 whitespace-nowrap">
                      {formatDayLabel(new Date(d))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.employees.map((emp) => (
                  <tr key={emp.id} className="border-t">
                    <td className="px-2 py-2 whitespace-nowrap sticky left-0 bg-card">{emp.name}</td>
                    {data.days.map((d) => {
                      const entry = data.entries.find((e) => e.employeeId === emp.id && e.date === d);
                      const val = entry?.isWorking;
                      return (
                        <td key={d} className="px-2 py-1.5 text-center">
                          <Select value={valueToOption(val)} onValueChange={(o) => o && setCell(emp.id, d, optionToValue(o))}>
                            <SelectTrigger
                              className={`w-24 mx-auto text-xs ${
                                val === true
                                  ? "border-primary/40 bg-primary/10 text-primary"
                                  : val === false
                                    ? "border-muted-foreground/30 bg-muted text-muted-foreground"
                                    : "border-dashed text-muted-foreground/50"
                              }`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kosong">- (belum diatur)</SelectItem>
                              <SelectItem value="masuk">Masuk</SelectItem>
                              <SelectItem value="libur">Libur</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
