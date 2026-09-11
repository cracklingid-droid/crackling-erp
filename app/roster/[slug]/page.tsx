"use client";

import { useEffect, useState, use as usePromise } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { addWeeks, dateKey, formatDayLabel } from "@/lib/roster";

type RosterData = {
  outlet: string;
  days: string[];
  employees: { id: number; name: string }[];
  entries: { employeeId: number; date: string; isWorking: boolean }[];
};

export default function PublicRosterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = usePromise(params);
  const [anchor, setAnchor] = useState(new Date());
  const [data, setData] = useState<RosterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/public/roster/${slug}?weekStart=${dateKey(anchor)}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) return setError(json.error ?? "Terjadi kesalahan");
        setError(null);
        setData(json);
      })
      .catch(() => setError("Terjadi kesalahan"))
      .finally(() => setLoading(false));
  }, [slug, anchor.getTime()]);

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground px-4 text-center">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-heading font-semibold tracking-tight">Roster Kerja{data ? ` - ${data.outlet}` : ""}</h1>
        </div>
        <p className="text-muted-foreground text-sm mb-6">Jadwal masuk/libur mingguan.</p>

        <div className="flex items-center gap-2 mb-4">
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

        <div className="overflow-x-auto rounded-lg border">
          {loading || !data ? (
            <p className="text-sm text-muted-foreground p-4">Memuat...</p>
          ) : data.employees.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Belum ada data karyawan untuk outlet ini.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  <th className="text-left font-medium px-3 py-2 sticky left-0 bg-muted/40">Karyawan</th>
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
                    <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-background">{emp.name}</td>
                    {data.days.map((d) => {
                      const entry = data.entries.find((e) => e.employeeId === emp.id && e.date === d);
                      const val = entry?.isWorking;
                      return (
                        <td key={d} className="px-2 py-1.5 text-center">
                          <span
                            className={`inline-block w-16 rounded-md px-2 py-1 text-xs ${
                              val === true
                                ? "bg-primary/10 text-primary"
                                : val === false
                                  ? "bg-muted text-muted-foreground"
                                  : "text-muted-foreground/40"
                            }`}
                          >
                            {val === true ? "Masuk" : val === false ? "Libur" : "-"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
