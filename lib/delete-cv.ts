import { del } from "@vercel/blob";
import { prisma } from "./db";

// Hapus file CV dari Vercel Blob storage + bersihkan referensinya di DB
// begitu kandidat berstatus "Ditolak", supaya storage tidak menumpuk file
// pelamar yang tidak lolos. Permintaan Kevin 2026-09-10.
export async function deleteCvForRejectedCandidate(candidateId: number) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { cvUrl: true },
  });
  if (!candidate?.cvUrl) return;

  try {
    await del(candidate.cvUrl);
  } catch (e) {
    console.error(`Gagal hapus CV kandidat #${candidateId} dari Blob storage:`, e);
  }

  await prisma.candidate.update({
    where: { id: candidateId },
    data: { cvUrl: null, cvTextPreview: null },
  });
}
