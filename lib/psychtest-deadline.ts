// Batas waktu pengerjaan psikotest: 2 jam sejak formulir biodata dikirim
// (Candidate.createdAt), auto-submit kalau lewat - permintaan Kevin
// 2026-09-10.
export const PSYCHTEST_DURATION_MS = 2 * 60 * 60 * 1000;

export function getPsychTestDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + PSYCHTEST_DURATION_MS);
}
