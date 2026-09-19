"use client";

import { useEffect, useRef, useState } from "react";
import { readJson, errorMessage } from "@/lib/fetch-json";
import { LoadingState } from "@/app/components/LoadingState";
import { upload } from "@vercel/blob/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Camera, MapPin, CheckCircle2, LogIn, LogOut, Loader2, RefreshCw, ScanFace, History } from "lucide-react";
import { EmptyState } from "@/app/components/EmptyState";

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
  hasFaceReference: boolean;
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
type CameraStatus = "idle" | "loading" | "ready" | "error";

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
  const [dialogType, setDialogType] = useState<"in" | "out" | "enroll" | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [geoError, setGeoError] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Wajib ambil foto LANGSUNG dari kamera (bukan pilih file dari galeri) -
  // supaya benar-benar selfie live, bukan foto lama/screenshot yang
  // diupload. Permintaan Kevin 2026-09-17: "hilangkan fitur upload, ganti
  // khusus untuk selfie".
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraError, setCameraError] = useState("");
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/portal/attendance")
      .then(readJson)
      .then(setData)
      .catch((e) => toast.error(errorMessage(e, "Gagal memuat data")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);
  useEffect(() => () => stopCamera(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startCamera() {
    setCameraStatus("loading");
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraStatus("ready");
    } catch {
      setCameraStatus("error");
      setCameraError("Tidak bisa akses kamera - izinkan akses kamera di browser lalu coba lagi.");
    }
  }

  function openDialog(type: "in" | "out" | "enroll") {
    setDialogType(type);
    setCapturedBlob(null);
    setCapturedPreview(null);
    setCoords(null);
    startCamera();
    // Pendaftaran wajah tidak butuh lokasi GPS - cuma cek wajah jelas & tanpa
    // masker, belum absen sungguhan.
    if (type === "enroll") {
      setGeoStatus("idle");
      return;
    }
    setGeoStatus("loading");
    setGeoError("");
    getPosition()
      .then((pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("ok");
      })
      .catch(() => {
        setGeoStatus("error");
        setGeoError("Izin lokasi ditolak/tidak tersedia - aktifkan izin GPS di browser lalu coba lagi.");
      });
  }

  function closeDialog() {
    if (submitting) return;
    stopCamera();
    if (capturedPreview) URL.revokeObjectURL(capturedPreview);
    setDialogType(null);
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        setCapturedPreview(URL.createObjectURL(blob));
        stopCamera();
      },
      "image/jpeg",
      0.9
    );
  }

  function retake() {
    if (capturedPreview) URL.revokeObjectURL(capturedPreview);
    setCapturedBlob(null);
    setCapturedPreview(null);
    startCamera();
  }

  async function handleSubmit() {
    if (!dialogType || !capturedBlob) return;
    if (dialogType !== "enroll" && !coords) return;
    setSubmitting(true);
    try {
      const file = new File([capturedBlob], `selfie-${dialogType}-${Date.now()}.jpg`, { type: "image/jpeg" });
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/portal/attendance-upload",
      });

      if (dialogType === "enroll") {
        const res = await fetch("/api/portal/attendance/face-reference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selfieUrl: blob.url }),
        });
        const json = await res.json();
        if (res.ok) {
          toast.success("Wajah berhasil didaftarkan - sekarang Anda bisa absen.");
          setDialogType(null);
          load();
        } else {
          toast.error(json.error || "Gagal mendaftarkan wajah");
        }
        return;
      }

      const res = await fetch("/api/portal/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: dialogType, selfieUrl: blob.url, lat: coords!.lat, lng: coords!.lng }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(dialogType === "in" ? "Absen masuk berhasil." : "Absen pulang berhasil.");
        setDialogType(null);
        load();
      } else {
        toast.error(json.error || "Gagal absen");
      }
    } catch {
      toast.error("Gagal upload foto. Periksa koneksi lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !!capturedBlob && !submitting && (dialogType === "enroll" || geoStatus === "ok");

  return (
    <div className="max-w-2xl grid gap-6">
      <div>
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Absensi</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-0.5">
          Absen masuk & pulang wajib pakai selfie langsung dari kamera dan lokasi GPS - hanya bisa dilakukan di lokasi outlet
          Anda ({data?.outlet ?? "-"}).
        </p>
      </div>

      {!loading && data && !data.hasLocationConfigured && (
        <Card className="border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">
            Titik lokasi untuk outlet Anda belum diatur HR/Admin - absen mandiri belum bisa dipakai. Hubungi HR.
          </CardContent>
        </Card>
      )}

      {!loading && data && !data.hasFaceReference && (
        <Card className="border-primary/40">
          <CardContent className="py-4 grid gap-2">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <ScanFace className="h-4 w-4 text-primary" /> Daftarkan Wajah Dulu
            </p>
            <p className="text-sm text-muted-foreground">
              Sebelum bisa absen, daftarkan wajah Anda sekali (tanpa masker, pencahayaan jelas) - dipakai sistem utk
              mencocokkan selfie absen berikutnya, mencegah orang lain absen menggantikan Anda. Setelah terdaftar, tidak
              bisa diganti sendiri - hubungi HR kalau perlu daftar ulang.
            </p>
            <Button onClick={() => openDialog("enroll")} className="w-fit">
              <ScanFace className="h-3.5 w-3.5" /> Daftarkan Wajah Sekarang
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="grid gap-4 py-5">
          {loading ? (
            <LoadingState variant="section" rows={2} />
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
                  disabled={!data?.hasLocationConfigured || !data?.hasFaceReference || !!data?.today?.clockIn}
                >
                  <LogIn className="h-3.5 w-3.5" /> Absen Masuk
                </Button>
                <Button
                  variant="outline"
                  onClick={() => openDialog("out")}
                  disabled={!data?.hasLocationConfigured || !data?.hasFaceReference || !data?.today?.clockIn || !!data?.today?.clockOut}
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
          <LoadingState variant="section" rows={2} />
        ) : !data || data.history.length === 0 ? (
          <EmptyState icon={History} title="Belum ada riwayat absensi" />
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
            <DialogTitle>{dialogType === "enroll" ? "Daftarkan Wajah" : dialogType === "in" ? "Absen Masuk" : "Absen Pulang"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {dialogType !== "enroll" && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className={`h-4 w-4 shrink-0 ${geoStatus === "ok" ? "text-primary" : geoStatus === "error" ? "text-destructive" : "text-muted-foreground"}`} />
                {geoStatus === "loading" && <span className="text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Mengambil lokasi GPS...</span>}
                {geoStatus === "ok" && <span className="text-primary">Lokasi GPS didapat.</span>}
                {geoStatus === "error" && <span className="text-destructive">{geoError}</span>}
              </div>
            )}
            {dialogType === "enroll" && (
              <p className="text-xs text-muted-foreground">
                Pastikan wajah terlihat jelas, pencahayaan cukup, dan tidak memakai masker.
              </p>
            )}

            <div className="grid gap-2">
              <label className="text-sm font-medium">Foto Selfie</label>
              <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-muted">
                {/* Video live selalu di-mount (disembunyikan pas ada capturedPreview) supaya stream tidak perlu direstart bolak-balik */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`h-full w-full object-cover -scale-x-100 ${capturedPreview ? "hidden" : ""}`}
                />
                {capturedPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={capturedPreview} alt="Pratinjau selfie" className="h-full w-full object-cover" />
                )}
                {!capturedPreview && cameraStatus === "loading" && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin" /> Mengaktifkan kamera...
                  </div>
                )}
                {!capturedPreview && cameraStatus === "error" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-sm text-destructive">
                    {cameraError}
                    <Button type="button" size="sm" variant="outline" onClick={startCamera}>
                      <RefreshCw className="h-3.5 w-3.5" /> Coba Lagi
                    </Button>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
              {!capturedPreview && cameraStatus === "ready" && (
                <Button type="button" onClick={capturePhoto}>
                  <Camera className="h-3.5 w-3.5" /> Ambil Foto
                </Button>
              )}
              {capturedPreview && (
                <Button type="button" variant="outline" onClick={retake}>
                  <RefreshCw className="h-3.5 w-3.5" /> Ambil Ulang
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={closeDialog} disabled={submitting}>Batal</Button>
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
              {submitting
                ? "Mengirim..."
                : dialogType === "enroll"
                  ? "Daftarkan Wajah"
                  : dialogType === "in"
                    ? "Kirim Absen Masuk"
                    : "Kirim Absen Pulang"}
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
