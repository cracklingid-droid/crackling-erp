"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CalendarCheck, MessageCircle } from "lucide-react";

const HR_WHATSAPP_NUMBER = "6282320910422";

type SlotState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "pending"; candidateName: string; jobTitle: string; slots: string[] }
  | { status: "booked"; candidateName: string; jobTitle: string; scheduledAt: string }
  | { status: "confirmed"; candidateName: string; jobTitle: string; tanggal: string; jam: string };

function buildWhatsappLink(candidateName: string, jobTitle: string, tanggal: string, jam: string) {
  const message = `Selamat siang, saya ${candidateName}, melamar untuk posisi ${jobTitle}. Saya mendapatkan jadwal interview pada ${tanggal} pukul ${jam}. Mohon konfirmasinya, terima kasih.`;
  return `https://wa.me/${HR_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function groupByDate(slots: string[]) {
  const map = new Map<string, string[]>();
  for (const iso of slots) {
    const d = new Date(iso);
    const wib = new Date(d.getTime() + 7 * 60 * 60000);
    const key = wib.toISOString().slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(iso);
  }
  return map;
}

function formatDateLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][date.getUTCDay()];
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][date.getUTCMonth()];
  return `${hari}, ${d} ${bulan} ${y}`;
}

function formatTimeLabel(iso: string) {
  const wib = new Date(new Date(iso).getTime() + 7 * 60 * 60000);
  return `${String(wib.getUTCHours()).padStart(2, "0")}.${String(wib.getUTCMinutes()).padStart(2, "0")}`;
}

export default function JadwalInterviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = usePromise(params);
  const [state, setState] = useState<SlotState>({ status: "loading" });
  const [selected, setSelected] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  function load() {
    fetch(`/api/public/interview-slots/${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) return setState({ status: "error", message: data.error ?? "Terjadi kesalahan" });
        setState(data);
      })
      .catch(() => setState({ status: "error", message: "Terjadi kesalahan" }));
  }

  useEffect(load, [token]);

  async function handleBook() {
    if (!selected) return;
    setBooking(true);
    const res = await fetch(`/api/public/interview-slots/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: selected }),
    });
    const data = await res.json();
    setBooking(false);
    if (res.ok) {
      const { candidateName, jobTitle } = state.status === "pending" ? state : { candidateName: "", jobTitle: "" };
      setState({ status: "confirmed", candidateName, jobTitle, tanggal: data.tanggal, jam: data.jam });
    } else {
      toast.error(data.error ?? "Gagal booking jadwal");
      load();
    }
  }

  if (state.status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Memuat...</div>;
  }

  if (state.status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-sm text-muted-foreground">{state.message}</p>
        <Link href="/lowongan" className="text-primary text-sm underline">Lihat lowongan</Link>
      </div>
    );
  }

  if (state.status === "booked" || state.status === "confirmed") {
    const tanggal = state.status === "confirmed" ? state.tanggal : formatDateLabel(new Date(state.scheduledAt).toISOString().slice(0, 10));
    const jam = state.status === "confirmed" ? state.jam : formatTimeLabel(state.scheduledAt) + " WIB";
    const candidateName = state.candidateName;
    const jobTitle = state.jobTitle;
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center grid gap-4">
            <div className="grid gap-3">
              <CalendarCheck className="h-10 w-10 text-primary mx-auto" />
              <h1 className="font-heading font-semibold text-xl">Jadwal Interview Terkonfirmasi</h1>
              <p className="text-sm text-muted-foreground">
                {tanggal}<br />Pukul {jam}
              </p>
              <p className="text-sm text-muted-foreground">
                Jadwal interview Anda telah berhasil tercatat dalam sistem kami. Konfirmasi resmi turut dikirimkan
                melalui email kepada Anda dan tim HR Crackling.
              </p>
            </div>
            {candidateName && jobTitle && (
              <div className="grid gap-2">
                <p className="text-sm text-muted-foreground">
                  Untuk memastikan kehadiran Anda, mohon konfirmasi langsung kepada tim HR kami melalui WhatsApp.
                </p>
                <a href={buildWhatsappLink(candidateName, jobTitle, tanggal, jam)} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full" size="lg">
                    <MessageCircle className="h-4 w-4" /> Konfirmasi via WhatsApp
                  </Button>
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const grouped = groupByDate(state.slots);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10 md:py-16">
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Pilih Jadwal Interview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Halo {state.candidateName}, silakan pilih tanggal & jam interview untuk posisi {state.jobTitle}.
        </p>

        {state.slots.length === 0 && (
          <p className="text-sm text-muted-foreground mt-6">Belum ada slot tersedia saat ini, silakan hubungi tim HR.</p>
        )}

        <div className="grid gap-5 mt-6">
          {Array.from(grouped.entries()).map(([dateKey, isoList]) => (
            <div key={dateKey}>
              <p className="text-sm font-medium mb-2">{formatDateLabel(dateKey)}</p>
              <div className="flex flex-wrap gap-2">
                {isoList.map((iso) => (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setSelected(iso)}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      selected === iso ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted/50"
                    }`}
                  >
                    {formatTimeLabel(iso)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {state.slots.length > 0 && (
          <Button className="mt-8 w-full" size="lg" disabled={!selected || booking} onClick={handleBook}>
            {booking ? "Menyimpan..." : "Konfirmasi Jadwal"}
          </Button>
        )}
      </div>
    </div>
  );
}
