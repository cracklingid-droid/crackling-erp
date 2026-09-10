"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, FileText, Mail, Phone, MapPin, GraduationCap, Briefcase as BriefcaseIcon, Wallet, CalendarClock, Download } from "lucide-react";
import { formatSlotWIB } from "@/lib/interview-slots";
import { PsychTestResultDialog } from "@/app/components/PsychTestResultDialog";

const STAGES = [
  { value: "applied", label: "Melamar" },
  { value: "screening", label: "Lolos Test" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Penawaran" },
  { value: "hired", label: "Diterima" },
  { value: "rejected", label: "Ditolak" },
];
const stageLabel = (v: string) => STAGES.find((s) => s.value === v)?.label ?? v;

const GENDER_LABEL: Record<string, string> = { L: "Laki-laki", P: "Perempuan" };

type Candidate = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  birthPlace: string | null;
  birthDate: string | null;
  gender: string | null;
  address: string | null;
  preferredOutlet: string | null;
  lastEducation: string | null;
  institution: string | null;
  experience: string | null;
  expectedSalary: number | null;
  cvUrl: string | null;
  cvTextPreview: string | null;
  stage: string;
  createdAt: string;
  jobPosting: { id: number; title: string; position: { id: number; name: string; passingScore: number } };
  psychTestSubmission: { percentage: number; passed: boolean; submittedAt: string } | null;
  interviewSlot: { scheduledAt: string } | null;
  stageEvents: { id: number; stage: string; note: string | null; createdAt: string; createdBy: { name: string } | null }[];
};

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm break-words">{value}</p>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export default function KandidatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [c, setC] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingStage, setChangingStage] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/api/candidates/${id}`)
      .then((r) => r.json())
      .then(setC)
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function handleStageChange(stage: string) {
    setChangingStage(true);
    const res = await fetch(`/api/candidates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    setChangingStage(false);
    if (res.ok) {
      toast.success(`Tahap diubah ke "${stageLabel(stage)}".`);
      load();
    } else {
      const err = await res.json();
      toast.error("Gagal: " + err.error);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Memuat...</p>;
  if (!c) return <p className="text-sm text-muted-foreground">Kandidat tidak ditemukan.</p>;

  return (
    <div className="max-w-3xl grid gap-6">
      <div>
        <Link href={`/hr/rekrutmen/${c.jobPosting.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke {c.jobPosting.title}
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-heading font-semibold tracking-tight">{c.name}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{c.jobPosting.title} &middot; {c.jobPosting.position.name}</p>
          </div>
          <Select value={c.stage} onValueChange={(v) => v && handleStageChange(v)}>
            <SelectTrigger className="w-44" disabled={changingStage}>
              <SelectValue>{() => stageLabel(c.stage)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STAGES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Biodata</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {c.email && <InfoRow icon={Mail} label="Email" value={c.email} />}
          {c.phone && <InfoRow icon={Phone} label="No. HP / WhatsApp" value={c.phone} />}
          {(c.birthPlace || c.birthDate) && (
            <InfoRow
              icon={CalendarClock}
              label="Tempat, Tanggal Lahir"
              value={`${c.birthPlace ?? "-"}, ${c.birthDate ? formatDate(c.birthDate) : "-"}${c.gender ? ` (${GENDER_LABEL[c.gender] ?? c.gender})` : ""}`}
            />
          )}
          {c.address && <InfoRow icon={MapPin} label="Alamat" value={c.address} />}
          {c.preferredOutlet && <InfoRow icon={MapPin} label="Lokasi/Cabang Diinginkan" value={c.preferredOutlet} />}
          {(c.lastEducation || c.institution) && (
            <InfoRow icon={GraduationCap} label="Pendidikan" value={`${c.lastEducation ?? "-"} - ${c.institution ?? "-"}`} />
          )}
          {c.experience && <InfoRow icon={BriefcaseIcon} label="Pengalaman Kerja" value={c.experience} />}
          {c.expectedSalary != null && (
            <InfoRow icon={Wallet} label="Ekspektasi Gaji" value={`Rp ${c.expectedSalary.toLocaleString("id-ID")}`} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CV</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {c.cvUrl ? (
            <a
              href={c.cvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline w-fit"
            >
              <Download className="h-3.5 w-3.5" /> Buka / unduh file CV
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">Kandidat tidak mengupload CV.</p>
          )}
          {c.cvTextPreview ? (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Pratinjau isi CV (hasil ekstraksi otomatis, mungkin tidak rapi tergantung format file asli):</p>
              <div className="rounded-md border bg-muted/30 p-3 max-h-80 overflow-y-auto">
                <pre className="text-xs whitespace-pre-wrap font-sans text-muted-foreground">{c.cvTextPreview}</pre>
              </div>
            </div>
          ) : (
            c.cvUrl && <p className="text-xs text-muted-foreground">Isi CV tidak berhasil dibaca otomatis (format file mungkin tidak didukung untuk pratinjau teks).</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Psikotest &amp; Interview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-28 shrink-0">Psikotest</span>
            {c.psychTestSubmission ? (
              <div className="flex items-center gap-1.5">
                <Badge variant={c.psychTestSubmission.passed ? "default" : "destructive"} className="font-normal">
                  {c.psychTestSubmission.percentage}% &middot; {c.psychTestSubmission.passed ? "Lulus" : "Tidak lulus"}
                </Badge>
                <PsychTestResultDialog candidateId={c.id} />
                <span className="text-xs text-muted-foreground">({formatDate(c.psychTestSubmission.submittedAt)})</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Belum mengikuti test</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-28 shrink-0">Interview</span>
            {c.interviewSlot ? (
              <span className="text-sm">
                {formatSlotWIB(new Date(c.interviewSlot.scheduledAt)).tanggal}, {formatSlotWIB(new Date(c.interviewSlot.scheduledAt)).jam}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Belum ada jadwal</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat Tahap</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {c.stageEvents.map((ev) => (
            <div key={ev.id} className="flex items-start gap-2.5 text-sm">
              <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <span className="font-medium">{stageLabel(ev.stage)}</span>
                <span className="text-muted-foreground"> &middot; {formatDate(ev.createdAt)}{ev.createdBy ? ` oleh ${ev.createdBy.name}` : ""}</span>
                {ev.note && <p className="text-xs text-muted-foreground mt-0.5">{ev.note}</p>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
