"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Crosshair, Loader2, CheckCircle2, Search } from "lucide-react";

type OutletLocationRow = {
  outlet: string;
  lat: number | null;
  lng: number | null;
  radiusMeters: number;
  updatedAt: string | null;
  updatedByName: string | null;
};
type SearchResult = { label: string; lat: number; lng: number };

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
// mandiri selfie+lokasi di Portal Karyawan - 3 cara isi: (1) "Gunakan Lokasi
// Saat Ini" - GPS browser, dipakai saat HR/staff benar-benar berdiri di
// outletnya; (2) searchbar cari alamat/nama jalan spt Google Maps (proxy ke
// OpenStreetMap Nominatim, gratis tanpa API key - lihat
// app/api/outlet-locations/search/route.ts); (3) tempel koordinat/link
// Google Maps langsung kalau sudah punya titik presisinya. Permintaan Kevin
// 2026-09-17.
export default function OutletLocationPage() {
  const [rows, setRows] = useState<OutletLocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [radiusDraft, setRadiusDraft] = useState<Record<string, string>>({});
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

  async function pickSearchResult(outlet: string, result: SearchResult) {
    const radiusMeters = radiusFor(outlet);
    if (radiusMeters === null) return;
    setBusyOutlet(outlet);
    try {
      await saveLocation(outlet, result.lat, result.lng, radiusMeters, "");
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
          Isi lewat GPS HP saat berdiri di lokasinya, cari alamat/nama jalan di kolom pencarian, atau tempel koordinat/link
          Google Maps kalau sudah punya titik presisinya.
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
              <OutletRow
                key={r.outlet}
                row={r}
                radiusValue={radiusDraft[r.outlet] ?? "50"}
                onRadiusChange={(v) => setRadiusDraft((d) => ({ ...d, [r.outlet]: v }))}
                busy={busyOutlet === r.outlet}
                onUseCurrentLocation={() => captureLocation(r.outlet)}
                onPickResult={(result) => pickSearchResult(r.outlet, result)}
              />
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Searchbar bisa diisi nama jalan/alamat (hasil dari OpenStreetMap) ATAU koordinat/link Google Maps langsung. Cara
        ambil koordinat di Google Maps: cari lokasinya, klik kanan (atau tekan lama di HP) tepat di titiknya, lalu klik
        angka koordinat yang muncul paling atas - otomatis tersalin ke clipboard.
      </p>
    </div>
  );
}

function OutletRow({
  row,
  radiusValue,
  onRadiusChange,
  busy,
  onUseCurrentLocation,
  onPickResult,
}: {
  row: OutletLocationRow;
  radiusValue: string;
  onRadiusChange: (v: string) => void;
  busy: boolean;
  onUseCurrentLocation: () => void;
  onPickResult: (result: SearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const coords = parseGoogleMapsCoords(value);
    if (coords) {
      setResults([{ label: `Gunakan koordinat ini: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`, lat: coords.lat, lng: coords.lng }]);
      setSearching(false);
      return;
    }
    if (value.trim().length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/outlet-locations/search?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } finally {
        setSearching(false);
      }
    }, 400);
  }

  function handlePick(result: SearchResult) {
    onPickResult(result);
    setQuery("");
    setResults([]);
  }

  return (
    <div className="grid gap-3 rounded-lg border px-3 py-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium flex items-center gap-1.5">
            {row.lat != null ? <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" /> : <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            {row.outlet}
          </p>
          {row.lat != null ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              {row.lat.toFixed(6)}, {row.lng!.toFixed(6)} · diperbarui {row.updatedAt ? fmtDate(row.updatedAt) : "-"}
              {row.updatedByName ? ` oleh ${row.updatedByName}` : ""}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">Belum diatur - absen mandiri akan selalu ditolak sampai lokasi diisi.</p>
          )}
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Radius (m)</Label>
          <Input type="number" min={10} max={1000} value={radiusValue} onChange={(e) => onRadiusChange(e.target.value)} className="w-24" />
        </div>
        <Button type="button" variant={row.lat != null ? "outline" : "default"} size="sm" disabled={busy} onClick={onUseCurrentLocation}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
          Gunakan Lokasi Saat Ini
        </Button>
      </div>

      <div className="relative border-t pt-3">
        <Label className="text-xs flex items-center gap-1 mb-1">
          <Search className="h-3 w-3" /> Cari alamat, atau tempel koordinat/link Google Maps
        </Label>
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="mis. Jl. Boulevard Raya, Gading Serpong"
            autoComplete="off"
            name={`outlet-location-search-${row.outlet}`}
          />
          {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-y-auto">
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handlePick(r)}
                disabled={busy}
                className="block w-full text-left px-3 py-2 text-xs hover:bg-muted/70 border-b last:border-b-0"
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
