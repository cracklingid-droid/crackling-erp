import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentEmployee } from "@/lib/current-employee";
import { checkFaceForEnrollment } from "@/lib/face-verify";

// Pendaftaran wajah pertama kali (Portal Karyawan) - dipakai sbg acuan
// verifikasi absen mandiri berikutnya. Sekali terdaftar, TIDAK bisa diganti
// sendiri (cegah orang lain "daftar ulang" jadi dia) - hubungi HR utk reset
// (lihat app/api/employees/[id]/route.ts, field faceReferenceUrl ikut
// STRING_FIELDS jadi bisa dikosongkan HR). Permintaan Kevin 2026-09-17.
export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (employee.faceReferenceUrl) {
    return NextResponse.json({ error: "Wajah sudah terdaftar - hubungi HR kalau perlu daftar ulang." }, { status: 400 });
  }

  const body = await req.json();
  const selfieUrl = typeof body.selfieUrl === "string" ? body.selfieUrl : "";
  if (!selfieUrl) return NextResponse.json({ error: "Foto selfie wajib dilampirkan" }, { status: 400 });

  let check;
  try {
    check = await checkFaceForEnrollment(selfieUrl);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal memeriksa foto, coba lagi." }, { status: 500 });
  }
  if (!check.faceVisible) {
    return NextResponse.json({ error: `Wajah tidak terlihat jelas di foto - ${check.reason}. Coba lagi dengan pencahayaan lebih baik.` }, { status: 400 });
  }
  if (check.wearingMask) {
    return NextResponse.json({ error: "Lepas masker dulu sebelum daftar wajah - peraturan perusahaan tidak memperbolehkan memakai masker saat absen." }, { status: 400 });
  }

  await prisma.employee.update({
    where: { id: employee.id },
    data: { faceReferenceUrl: selfieUrl, faceReferenceUpdatedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
