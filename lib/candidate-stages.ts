// Urutan tahap pipeline kandidat maju ke depan - dipakai di frontend (filter
// opsi dropdown) dan backend (validasi PATCH) supaya aturannya konsisten di
// satu tempat, tidak ketikan ulang di tiap halaman.
export const STAGE_ORDER = ["applied", "screening", "interview", "offer", "hired"] as const;
export type ForwardStage = (typeof STAGE_ORDER)[number];
export type StageValue = ForwardStage | "rejected";

export const STAGES: { value: StageValue; label: string }[] = [
  { value: "applied", label: "Melamar" },
  { value: "screening", label: "Lolos Test" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Penawaran" },
  { value: "hired", label: "Diterima" },
  { value: "rejected", label: "Ditolak" },
];

export function stageLabel(v: string): string {
  return STAGES.find((s) => s.value === v)?.label ?? v;
}

// Pipeline cuma boleh maju - kandidat tidak boleh dikembalikan ke tahap
// manapun yang sudah dilewati, di titik manapun dia berada sekarang
// (bukan cuma dari Interview ke atas) - permintaan Kevin 2026-09-11,
// setelah kandidat di tahap "Lolos Test" ternyata masih bisa dipindah
// balik ke "Melamar". "Ditolak" selalu boleh jadi tujuan (jalur keluar
// kapan saja), dan dari "Ditolak" boleh dibuka lagi ke tahap manapun
// (siapa tahu HR salah tolak / mau pertimbangkan ulang).
export function isStageTransitionAllowed(currentStage: string, targetStage: string): boolean {
  if (targetStage === "rejected") return true;
  const currentIdx = STAGE_ORDER.indexOf(currentStage as ForwardStage);
  if (currentIdx === -1) return true; // dari "rejected", boleh dibuka lagi ke tahap manapun
  const targetIdx = STAGE_ORDER.indexOf(targetStage as ForwardStage);
  if (targetIdx === -1) return true;
  return targetIdx >= currentIdx;
}

export function allowedNextStages(currentStage: string): StageValue[] {
  return STAGES.map((s) => s.value).filter((v) => isStageTransitionAllowed(currentStage, v));
}

// Pesan error dipakai backend & bisa ditampilkan langsung di toast frontend.
export const STAGE_ROLLBACK_ERROR =
  "Kandidat tidak bisa dikembalikan ke tahap sebelumnya. Pilihan yang tersedia hanya tahap saat ini, tahap berikutnya, atau Ditolak.";
