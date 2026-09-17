"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Crosshair, Loader2, CheckCircle2, Map as MapIcon } from "lucide-react";

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

// Baca koordinat dari teks yang ditempel dari Google Maps - dukung 2 cara:
// 1) Klik kanan titik lokasi di Google Maps -> klik koordinat yang muncul
//    di menu (otomatis tersalin), tempel apa adanya ("-6.229728, 106.689403").
// 2) Tempel link URL Google Maps yang isinya koordinat (".../@lat,lng,17z",
//    "?q=lat,lng", "&ll=lat,lng"). Link pendek (maps.app.goo.gl) TIDAK bisa
//    dibaca (butuh dibuka dulu di browser sampai jadi URL penuh).
function parseGoogleMapsCoords(input: string): { lat: number; lng: number } | null {
  const s = input.trim();
  let m = s.match(/^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/);
  if (!m) m = s.match(/[@=](-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

// Atur titik lokasi (lat/lng) + radius tiap outlet utk validasi absen
// mandiri selfie+lokasi di Portal Karyawan - 2 cara isi: (1) "Gunakan Lokasi
// Saat Ini" - GPS browser, dipakai saat HR/staff benar-benar berdiri di
// outletnya; (2) tempel koordinat/link Google Maps - dipakai dari mana saja
// tanpa perlu ke lokasi fisik (cari titiknya di Google Maps dulu).
// Permintaan Kevin 2026-09-17.
export default function OutletLocationPage() {
  const [rows, setRows] = useState<OutletLocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [radiusDraft, setRadiusDraft] = useState<Record<string, string>>({});
  const [mapsDraft, setMapsDraft] = useState<Record<string, string>>({});
  const [busyOutlet, setBusyOutlet] = useState<string | null>(null);

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

  function radiusFor(outlet: string): number | null {
    const radiusMeters = Number(radiusDraft[outlet]);
    if (!Number.isFinite(radiusMeters) || radiusMeters < 10 || radiusMeters > 1000) {
      toast.error("Radius harus angka antara 10-1000 meter");
      return null;
    }
    return radiusMeters;
  }

  async function saveLocation(outlet: string, lat: number, lng: number, radiusMeters: number, successNote: string) {
    const res = await fetch("/api/outlet-locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outlet, lat, lng, radiusMeters }),
    });
    const json = await res.json();
    if (res.ok) {
      toast.success(`Lokasi "${outlet}" disimpan${successNote}.`);
      setMapsDraft((d) => ({ ...d, [outlet]: "" }));
      load();
    } else {
      toast.error(json.error || "Gagal simpan lokasi");
    }
  }

  async function captureLocation(outlet: string) {
    const radiusMeters = radiusFor(outlet);
    if (radiusMeters === null) return;
    setBusyOutlet(outlet);
    try {
      const pos = await getPosition();
      await saveLocation(outlet, pos.coords.latitude, pos.coords.longitude, radiusMeters, ` (akurasi GPS ±${Math.round(pos.coords.accuracy)}m)`);
    } catch {
      toast.error("Gagal ambil lokasi GPS - aktifkan izin lokasi di browser lalu coba lagi.");
    } finally {
      setBusyOutlet(null);
    }
  }

  async function saveFromMaps(outlet: string) {
    const radiusMeters = radiusFor(outlet);
    if (radiusMeters === null) return;
    const coords = parseGoogleMapsCoords(mapsDraft[outlet] ?? "");
    if (!coords) {
      toast.error(
        "Tidak bisa baca koordinat - klik kanan titik lokasi di Google Maps, klik koordinat yang muncul (otomatis tersalin), lalu tempel di sini. Link pendek (maps.app.goo.gl) tidak bisa dibaca."
      );
      return;
    }
    setBusyOutlet(outlet);
    try {
      await saveLocation(outlet, coords.lat, coords.lng, radiusMeters, " dari Google Maps");
    } finally {
      setBusyOutlet(null);
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
          Isi lewat GPS HP saat berdiri di lokasinya, atau tempel koordinat/link dari Google Maps kalau tidak sedang di
          lokasi.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Titik Lokasi per Outlet</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat...</p>
          ) : (
            rows.map((r) => (
              <div key={r.outlet} className="grid gap-3 rounded-lg border px-3 py-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-0 flex-1">
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
                    disabled={busyOutlet === r.outlet}
                    onClick={() => captureLocation(r.outlet)}
                  >
                    {busyOutlet === r.outlet ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
                    Gunakan Lokasi Saat Ini
                  </Button>
                </div>

                <div className="flex flex-wrap items-end gap-2 border-t pt-3">
                  <div className="grid gap-1 min-w-0 flex-1">
                    <Label className="text-xs flex items-center gap-1">
                      <MapIcon className="h-3 w-3" /> Atau tempel koordinat/link Google Maps
                    </Label>
                    <Input
                      value={mapsDraft[r.outlet] ?? ""}
                      onChange={(e) => setMapsDraft((d) => ({ ...d, [r.outlet]: e.target.value }))}
                      placeholder="mis. -6.229728, 106.689403"
                      className="font-mono text-xs"
                    />
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled={busyOutlet === r.outlet || !mapsDraft[r.outlet]} onClick={() => saveFromMaps(r.outlet)}>
                    Simpan
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Cara ambil koordinat di Google Maps: cari lokasinya, klik kanan (atau tekan lama di HP) tepat di titiknya, lalu klik
        angka koordinat yang muncul paling atas - otomatis tersalin ke clipboard, tinggal tempel di sini.
      </p>
    </div>
  );
}
