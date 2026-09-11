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

// Pipeline cuma boleh maju SATU tahap demi satu tahap - tidak boleh
// dikembalikan ke tahap manapun yang sudah dilewati (permintaan Kevin
// 2026-09-11 sebelumnya), dan sekarang juga tidak boleh loncat lebih dari
// 1 tahap ke depan sekaligus (permintaan Kevin 2026-09-11: "hanya boleh 1
// demi 1 tahap kanbannya berjalan" - dropdown sebelumnya sempat
// menampilkan semua tahap ke depan sampai "Diterima" sekaligus dari
// "Lolos Test", padahal harusnya cuma boleh ke "Interview" dulu).
// "Ditolak" selalu boleh jadi tujuan (jalur keluar kapan saja dari tahap
// manapun), dan dari "Ditolak" boleh dibuka lagi ke tahap manapun (siapa
// tahu HR salah tolak / mau pertimbangkan ulang).
export function isStageTransitionAllowed(currentStage: string, targetStage: string): boolean {
  if (targetStage === "rejected") return true;
  const currentIdx = STAGE_ORDER.indexOf(currentStage as ForwardStage);
  if (currentIdx === -1) return true; // dari "rejected", boleh dibuka lagi ke tahap manapun
  const targetIdx = STAGE_ORDER.indexOf(targetStage as ForwardStage);
  if (targetIdx === -1) return true;
  return targetIdx === currentIdx || targetIdx === currentIdx + 1;
}

export function allowedNextStages(currentStage: string): StageValue[] {
  return STAGES.map((s) => s.value).filter((v) => isStageTransitionAllowed(currentStage, v));
}

// Pesan error dipakai backend & bisa ditampilkan langsung di toast frontend.
export const STAGE_ROLLBACK_ERROR =
  "Kandidat cuma bisa dipindah 1 tahap ke depan setiap kali, tidak boleh mundur atau meloncat. Pilihan yang tersedia hanya tahap saat ini, tahap berikutnya, atau Ditolak.";
