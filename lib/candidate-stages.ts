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

// Kandidat yang sudah sampai tahap Interview tidak boleh dikembalikan ke
// Melamar/Lolos Test - permintaan Kevin 2026-09-10, supaya pipeline
// mengalir maju dan tidak ada kandidat "mundur" tanpa sengaja.
export function allowedNextStages(currentStage: string): StageValue[] {
  const idx = STAGE_ORDER.indexOf(currentStage as ForwardStage);
  const interviewIdx = STAGE_ORDER.indexOf("interview");
  const all = STAGES.map((s) => s.value);
  if (idx >= interviewIdx) {
    return all.filter((v) => v !== "applied" && v !== "screening");
  }
  return all;
}

// Pesan error dipakai backend & bisa ditampilkan langsung di toast frontend.
export const STAGE_ROLLBACK_ERROR =
  "Kandidat yang sudah sampai tahap Interview tidak bisa dikembalikan ke Melamar atau Lolos Test. Opsi yang tersedia hanya Penawaran atau Ditolak.";
