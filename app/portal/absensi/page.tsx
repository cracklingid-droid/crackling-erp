"use client";

import { useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Camera, MapPin, CheckCircle2, LogIn, LogOut, Loader2 } from "lucide-react";

type AttendanceRecord = {
  id: number;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  clockInSelfieUrl: string | null;
  clockOutSelfieUrl: string | null;
};
type AttendanceData = {
  today: AttendanceRecord | null;
  history: AttendanceRecord[];
  outlet: string | null;
  hasLocationConfigured: boolean;
  radiusMeters: number | null;
};

function fmtTime(iso: string) {
  // Konvensi jam absensi (lihat lib/wib-time.ts): komponen UTC = jam
  // dinding WIB langsung, jadi ambil dari string ISO, JANGAN
  // toLocaleTimeString() yang ikut zona waktu browser.
  return iso.slice(11, 16);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
}

type GeoStatus = "idle" | "loading" | "ok" | "error";

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Browser ini tidak mendukung lokasi GPS"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
}

export default function PortalAbsensiPage() {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogType, setDialogType] = useState<"in" | "out" | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [geoError, setGeoError] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/portal/attendance")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openDialog(type: "in" | "out") {
    setDialogType(type);
    setSelfieFile(null);
    setSelfiePreview(null);
    setCoords(null);
    setGeoStatus("loading");
    setGeoError("");
    getPosition()
      .then((pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("ok");
      })
      .catch((e: GeolocationPositionError | Error) => {
        setGeoStatus("error");
        setGeoError(
          "code" in e
            ? "Izin lokasi ditolak/tidak tersedia - aktifkan izin GPS di browser lalu coba lagi."
            : e.message
        );
      });
  }

  function closeDialog() {
    if (submitting) return;
    setDialogType(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelfieFile(file);
    setSelfiePreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit() {
    if (!dialogType || !selfieFile || !coords) return;
    setSubmitting(true);
    try {
      const blob = await upload(selfieFile.name, selfieFile, {
        access: "public",
        handleUploadUrl: "/api/portal/attendance-upload",
      });
      const res = await fetch("/api/portal/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: dialogType, selfieUrl: blob.url, lat: coords.lat, lng: coords.lng }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(dialogType === "in" ? "Absen masuk berhasil." : "Absen pulang berhasil.");
        setDialogType(null);
        load();
      } else {
        toast.error(json.error || "Gagal absen");
      }
    } catch (err) {
      toast.error("Gagal upload foto: " + (err instanceof Error ? err.message : "unknown"));
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !!selfieFile && geoStatus === "ok" && !submitting;

  return (
    <div className="max-w-2xl grid gap-6">
      <div>
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Absensi</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-0.5">
          Absen masuk & pulang wajib pakai selfie dan lokasi GPS - hanya bisa dilakukan di lokasi outlet Anda ({data?.outlet ?? "-"}).
        </p>
      </div>

      {!loading && data && !data.hasLocationConfigured && (
        <Card className="border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">
            Titik lokasi untuk outlet Anda belum diatur HR/Admin - absen mandiri belum bisa dipakai. Hubungi HR.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="grid gap-4 py-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat...</p>
          ) : (
            <>
              <div className="grid gap-1.5 text-sm">
                <StatusLine
                  done={!!data?.today?.clockIn}
                  label={data?.today?.clockIn ? `Absen masuk pukul ${fmtTime(data.today.clockIn)}` : "Belum absen masuk"}
                />
                <StatusLine
                  done={!!data?.today?.clockOut}
                  label={data?.today?.clockOut ? `Absen pulang pukul ${fmtTime(data.today.clockOut)}` : "Belum absen pulang"}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => openDialog("in")}
                  disabled={!data?.hasLocationConfigured || !!data?.today?.clockIn}
                >
                  <LogIn className="h-3.5 w-3.5" /> Absen Masuk
                </Button>
                <Button
                  variant="outline"
                  onClick={() => openDialog("out")}
                  disabled={!data?.hasLocationConfigured || !data?.today?.clockIn || !!data?.today?.clockOut}
                >
                  <LogOut className="h-3.5 w-3.5" /> Absen Pulang
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Riwayat 14 Hari Terakhir</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Memuat...</p>
        ) : !data || data.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada riwayat absensi.</p>
        ) : (
          <div className="grid gap-1.5">
            {data.history.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="font-medium">{fmtDate(h.date)}</span>
                <span className="text-muted-foreground tabular-nums">
                  {h.clockIn ? fmtTime(h.clockIn) : "-"} &rarr; {h.clockOut ? fmtTime(h.clockOut) : "-"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!dialogType} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialogType === "in" ? "Absen Masuk" : "Absen Pulang"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className={`h-4 w-4 shrink-0 ${geoStatus === "ok" ? "text-primary" : geoStatus === "error" ? "text-destructive" : "text-muted-foreground"}`} />
              {geoStatus === "loading" && <span className="text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Mengambil lokasi GPS...</span>}
              {geoStatus === "ok" && <span className="text-primary">Lokasi GPS didapat.</span>}
              {geoStatus === "error" && <span className="text-destructive">{geoError}</span>}
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Foto Selfie</label>
              <input
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleFileChange}
                className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm"
              />
              {selfiePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selfiePreview} alt="Pratinjau selfie" className="mt-1 h-40 w-40 rounded-lg object-cover border" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={closeDialog} disabled={submitting}>Batal</Button>
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
              {submitting ? "Mengirim..." : dialogType === "in" ? "Kirim Absen Masuk" : "Kirim Absen Pulang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusLine({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2 className={`h-4 w-4 ${done ? "text-primary" : "text-muted-foreground/40"}`} />
      <span className={done ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
