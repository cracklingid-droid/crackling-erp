"use client";

import { useEffect, useState, useRef, use as usePromise } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

type Question = { id: number; text: string; options: { id: number; label: string }[] };
type TestState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "pending"; candidateName: string; positionName: string; questions: Question[]; deadline: string }
  | { status: "submitted"; passed: boolean; percentage: number }
  | { status: "result"; passed: boolean; percentage: number };

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function PsikotesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = usePromise(params);
  const [state, setState] = useState<TestState>({ status: "loading" });
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const autoSubmittedRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    fetch(`/api/public/psychtest/${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setState(data))
      .catch(() => setState({ status: "not-found" }));
  }, [token]);

  async function submitAnswers(currentAnswers: Record<number, number>, auto: boolean) {
    const res = await fetch(`/api/public/psychtest/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: Object.entries(currentAnswers).map(([questionId, optionId]) => ({
          questionId: Number(questionId),
          optionId,
        })),
        autoSubmit: auto,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setState({ status: "result", passed: data.passed, percentage: data.percentage });
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Gagal mengirim jawaban");
    }
  }

  async function handleSubmit() {
    if (state.status !== "pending") return;
    if (Object.keys(answers).length !== state.questions.length) {
      toast.error("Semua pertanyaan wajib dijawab");
      return;
    }
    setSubmitting(true);
    await submitAnswers(answers, false);
    setSubmitting(false);
  }

  // Countdown waktu psikotest (2 jam sejak formulir biodata dikirim) - lewat
  // waktu, jawaban yang sudah terisi otomatis dikirim (permintaan Kevin
  // 2026-09-10).
  useEffect(() => {
    if (state.status !== "pending") return;
    const deadline = new Date(state.deadline).getTime();

    function tick() {
      const left = deadline - Date.now();
      setRemainingMs(left);
      if (left <= 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        toast.error("Waktu psikotest habis, jawaban Anda otomatis dikirim.");
        submitAnswers(answersRef.current, true);
      }
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status === "pending" ? state.deadline : null]);

  if (state.status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Memuat...</div>;
  }

  if (state.status === "not-found") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-sm text-muted-foreground">Tautan tidak valid atau sudah kedaluwarsa.</p>
        <Link href="/lowongan" className="text-primary text-sm underline">Lihat lowongan</Link>
      </div>
    );
  }

  if (state.status === "submitted" || state.status === "result") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center grid gap-3">
            {state.passed ? (
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            ) : (
              <XCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            )}
            <h1 className="font-heading font-semibold text-xl">
              {state.passed ? "Selamat, Anda lolos psikotest!" : "Terima kasih telah mengikuti psikotest"}
            </h1>
            {state.passed ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Detail dan link untuk memilih jadwal interview sudah kami kirim ke email Anda.
                </p>
                <Link href={`/jadwal-interview/${token}`}>
                  <Button className="mt-2">Pilih Jadwal Interview</Button>
                </Link>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Hasil dan informasi lebih lanjut sudah kami kirim ke email Anda. Terima kasih atas minat Anda bergabung dengan Crackling.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const isLowTime = remainingMs !== null && remainingMs < 10 * 60 * 1000;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10 md:py-16">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-semibold tracking-tight">Psikotest - {state.positionName}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Halo {state.candidateName}, jawab {state.questions.length} pertanyaan berikut sesuai dengan diri Anda. Tidak ada jawaban benar/salah.
            </p>
          </div>
          {remainingMs !== null && (
            <div className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium tabular-nums shrink-0 ${isLowTime ? "border-destructive text-destructive" : "text-foreground"}`}>
              <Clock className="h-3.5 w-3.5" />
              {formatRemaining(remainingMs)}
            </div>
          )}
        </div>
        <p className="text-sm mt-2 font-medium">{answeredCount} / {state.questions.length} terjawab</p>

        <div className="grid gap-4 mt-6">
          {state.questions.map((q, qi) => (
            <Card key={q.id}>
              <CardHeader>
                <CardTitle className="text-base font-medium">{qi + 1}. {q.text}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {q.options.map((o) => (
                  <label
                    key={o.id}
                    className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                      answers[q.id] === o.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      className="accent-primary"
                      checked={answers[q.id] === o.id}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                    />
                    {o.label}
                  </label>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <Button
          className="mt-6 w-full"
          size="lg"
          disabled={submitting || answeredCount !== state.questions.length}
          onClick={handleSubmit}
        >
          {submitting ? "Mengirim..." : "Kirim Jawaban"}
        </Button>
      </div>
    </div>
  );
}
