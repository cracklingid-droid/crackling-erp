"use client";

import { useEffect, useState } from "react";
import { formatRupiah as fmtRupiah } from "@/lib/format";
import { readJson, errorMessage } from "@/lib/fetch-json";
import { LoadingState } from "@/app/components/LoadingState";
import { ErrorState } from "@/app/components/ErrorState";
import { EmptyState } from "@/app/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Receipt } from "lucide-react";
import { toast } from "sonner";

type Slip = {
  itemId: number;
  periodId: number;
  label: string;
  startDate: string;
  endDate: string;
  category: string;
  netPay: number;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

async function downloadSlip(itemId: number) {
  const res = await fetch(`/api/portal/slips/${itemId}/pdf`);
  if (!res.ok) {
    toast.error("Gagal download slip");
    return;
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename\*=UTF-8''([^;]+)/);
  const filename = match ? decodeURIComponent(match[1]) : "slip.pdf";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PortalSlipGajiPage() {
  const [slips, setSlips] = useState<Slip[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  function load() {
    setLoadError(null);
    fetch("/api/portal/slips")
      .then(readJson)
      .then(setSlips)
      .catch((e) => setLoadError(errorMessage(e, "Gagal memuat slip gaji.")));
  }
  useEffect(load, []);

  return (
    <div className="max-w-2xl grid gap-6">
      <div>
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Slip Gaji</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-0.5">Riwayat slip gaji Anda selama pernah bekerja di Crackling F&amp;B.</p>
      </div>

      {loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : slips === null ? (
        <LoadingState variant="section" />
      ) : slips.length === 0 ? (
        <EmptyState icon={Receipt} title="Belum ada slip gaji" description="Slip gaji akan muncul di sini setelah periode gaji difinalisasi HR." />
      ) : (
        <div className="grid gap-2">
          {slips.map((s) => (
            <Card key={s.itemId}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(s.startDate)} - {fmtDate(s.endDate)}
                  </p>
                  <p className="text-sm font-medium tabular-nums">{fmtRupiah(s.netPay)}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => downloadSlip(s.itemId)}>
                  <Download className="h-3.5 w-3.5" /> PDF
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
