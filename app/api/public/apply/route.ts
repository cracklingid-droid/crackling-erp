import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const REQUIRED_FIELDS = [
  "name", "email", "phone", "birthPlace", "birthDate", "gender",
  "address", "preferredOutlet", "lastEducation", "institution", "expectedSalary", "experience", "cvUrl",
] as const;

const MIN_AGE = 18;

export async function POST(req: Request) {
  const body = await req.json();
  const jobPostingId = Number(body.jobPostingId);
  if (!jobPostingId) return NextResponse.json({ error: "Lowongan tidak valid" }, { status: 400 });

  const posting = await prisma.jobPosting.findUnique({ where: { id: jobPostingId }, include: { position: true } });
  if (!posting || posting.status !== "open") {
    return NextResponse.json({ error: "Lowongan sudah ditutup, tidak bisa menerima lamaran baru" }, { status: 400 });
  }

  for (const f of REQUIRED_FIELDS) {
    if (!body[f] || (typeof body[f] === "string" && !body[f].trim())) {
      return NextResponse.json({ error: `Kolom "${f}" wajib diisi` }, { status: 400 });
    }
  }

  if (posting.position.requiresKitchenTerms) {
    if (!body.agreedB2 || !body.agreedLongShift || !body.agreedNoPinjol) {
      return NextResponse.json({ error: "Semua Syarat & Ketentuan wajib dicentang" }, { status: 400 });
    }
  }
  if (!body.agreedStartSoon) {
    return NextResponse.json({ error: "Kesediaan mengisi psikotest dalam 30 menit wajib dicentang" }, { status: 400 });
  }

  const expectedSalary = Number(body.expectedSalary);
  if (!Number.isFinite(expectedSalary) || expectedSalary <= 0) {
    return NextResponse.json({ error: "Ekspektasi gaji tidak valid" }, { status: 400 });
  }

  const birthDate = new Date(body.birthDate);
  if (isNaN(birthDate.getTime())) {
    return NextResponse.json({ error: "Tanggal lahir tidak valid" }, { status: 400 });
  }
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) age--;
  if (age < MIN_AGE) {
    return NextResponse.json({ error: `Pelamar harus berusia minimal ${MIN_AGE} tahun` }, { status: 400 });
  }

  const candidate = await prisma.candidate.create({
    data: {
      jobPostingId,
      name: String(body.name).trim(),
      email: String(body.email).trim(),
      phone: String(body.phone).trim(),
      source: "Lamaran Publik",
      birthPlace: String(body.birthPlace).trim(),
      birthDate,
      gender: String(body.gender),
      address: String(body.address).trim(),
      preferredOutlet: String(body.preferredOutlet).trim(),
      lastEducation: String(body.lastEducation),
      institution: String(body.institution).trim(),
      experience: String(body.experience).trim(),
      expectedSalary: Math.round(expectedSalary),
      cvUrl: typeof body.cvUrl === "string" ? body.cvUrl.trim() || null : null,
      cvTextPreview: typeof body.cvTextPreview === "string" ? body.cvTextPreview.trim() || null : null,
      agreedB2: posting.position.requiresKitchenTerms ? true : false,
      agreedLongShift: posting.position.requiresKitchenTerms ? true : false,
      agreedNoPinjol: posting.position.requiresKitchenTerms ? true : false,
      agreedStartSoon: true,
      stage: "applied",
    },
  });

  return NextResponse.json({ token: candidate.publicToken }, { status: 201 });
}
