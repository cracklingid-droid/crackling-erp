"use client";

import { useEffect, useState } from "react";
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

function fmtRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
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

  useEffect(() => {
    fetch("/api/portal/slips")
      .then((r) => r.json())
      .then(setSlips);
  }, []);

  return (
    <div className="max-w-2xl grid gap-6">
      <div>
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Slip Gaji</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-0.5">Riwayat slip gaji Anda selama pernah bekerja di Crackling F&amp;B.</p>
      </div>

      {slips === null ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : slips.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada slip gaji yang diterbitkan.</p>
      ) : (
        <div className="grid gap-2">
          {slips.map((s) => (
            <Card key={s.itemId}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(s.startDate)} - {fmtDate(s.endDate)} · {fmtRupiah(s.netPay)}
                  </p>
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
