"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { readJson, errorMessage } from "@/lib/fetch-json";
import { LoadingState } from "@/app/components/LoadingState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { addWeeks, dateKey, formatDayLabel } from "@/lib/roster";

type RosterData = {
  outlet: string | null;
  days: string[];
  entries: { date: string; isWorking: boolean }[];
};

export default function PortalRosterPage() {
  const [anchor, setAnchor] = useState(new Date());
  const [data, setData] = useState<RosterData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/portal/roster?weekStart=${dateKey(anchor)}`)
      .then(readJson)
      .then(setData)
      .catch((e) => toast.error(errorMessage(e, "Gagal memuat data")))
      .finally(() => setLoading(false));
  }, [anchor.getTime()]);

  return (
    <div className="max-w-xl grid gap-6">
      <div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Roster Kerja</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-0.5">Jadwal masuk/libur mingguan Anda{data?.outlet ? ` di ${data.outlet}` : ""}.</p>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Minggu sebelumnya" title="Minggu sebelumnya" onClick={() => setAnchor((a) => addWeeks(a, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {data ? `${formatDayLabel(new Date(data.days[0]))} - ${formatDayLabel(new Date(data.days[6]))}` : "..."}
        </span>
        <Button variant="outline" size="icon" aria-label="Minggu berikutnya" title="Minggu berikutnya" onClick={() => setAnchor((a) => addWeeks(a, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        {loading || !data ? (
          <LoadingState variant="section" className="p-4" />
        ) : (
          <div className="grid divide-y">
            {data.days.map((d) => {
              const entry = data.entries.find((e) => e.date === d);
              const val = entry?.isWorking;
              return (
                <div key={d} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm">{formatDayLabel(new Date(d))}</span>
                  <span
                    className={`inline-block w-20 text-center rounded-md px-2 py-1 text-sm ${
                      val === true
                        ? "bg-primary/10 text-primary"
                        : val === false
                          ? "bg-muted text-foreground/70"
                          : "text-muted-foreground/40"
                    }`}
                  >
                    {val === true ? "Masuk" : val === false ? "Libur" : "-"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
