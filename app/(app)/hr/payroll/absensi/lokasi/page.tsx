"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Crosshair, Loader2, CheckCircle2 } from "lucide-react";

type OutletLocationRow = {
  outlet: string;
  lat: number | null;
  lng: number | null;
  radiusMeters: number;
  updatedAt: string | null;
  updatedByName: string | null;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Browser ini tidak mendukung lokasi GPS"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
}

// Atur titik lokasi (lat/lng) + radius tiap outlet utk validasi absen
// mandiri selfie+lokasi di Portal Karyawan - HR/Admin berdiri langsung di
// outlet, klik "Gunakan Lokasi Saat Ini", GPS HP otomatis terisi tanpa perlu
// cari koordinat manual di Google Maps. Permintaan Kevin 2026-09-17.
export default function OutletLocationPage() {
  const [rows, setRows] = useState<OutletLocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [radiusDraft, setRadiusDraft] = useState<Record<string, string>>({});
  const [capturingOutlet, setCapturingOutlet] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/outlet-locations")
      .then((r) => r.json())
      .then((data: OutletLocationRow[]) => {
        setRows(data);
        setRadiusDraft(Object.fromEntries(data.map((r) => [r.outlet, String(r.radiusMeters)])));
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function captureLocation(outlet: string) {
    const radiusMeters = Number(radiusDraft[outlet]);
    if (!Number.isFinite(radiusMeters) || radiusMeters < 10 || radiusMeters > 1000) {
      toast.error("Radius harus angka antara 10-1000 meter");
      return;
    }
    setCapturingOutlet(outlet);
    try {
      const pos = await getPosition();
      const res = await fetch("/api/outlet-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outlet, lat: pos.coords.latitude, lng: pos.coords.longitude, radiusMeters }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Lokasi "${outlet}" disimpan (akurasi GPS ±${Math.round(pos.coords.accuracy)}m).`);
        load();
      } else {
        toast.error(json.error || "Gagal simpan lokasi");
      }
    } catch (e) {
      toast.error(
        e instanceof GeolocationPositionError || (e as Error)?.message
          ? "Gagal ambil lokasi GPS - aktifkan izin lokasi di browser lalu coba lagi."
          : "Gagal ambil lokasi GPS"
      );
    } finally {
      setCapturingOutlet(null);
    }
  }

  return (
    <div className="max-w-3xl grid gap-6">
      <div>
        <Link href="/hr/payroll/absensi" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Upload Absensi
        </Link>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Lokasi Absensi Mandiri</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Titik lokasi tiap outlet - dipakai memvalidasi absen selfie+GPS di Portal Karyawan (di luar radius, absen ditolak).
          Buka halaman ini dari HP saat Anda benar-benar berdiri di outletnya, atur radius kalau perlu, lalu klik "Gunakan
          Lokasi Saat Ini".
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Titik Lokasi per Outlet</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat...</p>
          ) : (
            rows.map((r) => (
              <div key={r.outlet} className="grid gap-2 rounded-lg border px-3 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-end sm:gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    {r.lat != null ? <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" /> : <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    {r.outlet}
                  </p>
                  {r.lat != null ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.lat.toFixed(6)}, {r.lng!.toFixed(6)} · diperbarui {r.updatedAt ? fmtDate(r.updatedAt) : "-"}
                      {r.updatedByName ? ` oleh ${r.updatedByName}` : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">Belum diatur - absen mandiri akan selalu ditolak sampai lokasi diisi.</p>
                  )}
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Radius (m)</Label>
                  <Input
                    type="number"
                    min={10}
                    max={1000}
                    value={radiusDraft[r.outlet] ?? "50"}
                    onChange={(e) => setRadiusDraft((d) => ({ ...d, [r.outlet]: e.target.value }))}
                    className="w-24"
                  />
                </div>
                <Button
                  type="button"
                  variant={r.lat != null ? "outline" : "default"}
                  size="sm"
                  disabled={capturingOutlet === r.outlet}
                  onClick={() => captureLocation(r.outlet)}
                >
                  {capturingOutlet === r.outlet ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
                  {capturingOutlet === r.outlet ? "Mengambil..." : "Gunakan Lokasi Saat Ini"}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
