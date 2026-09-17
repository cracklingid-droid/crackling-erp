import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentEmployee } from "@/lib/current-employee";
import { getOutletLocation } from "@/lib/outlet-locations";
import { distanceMeters } from "@/lib/geo";
import { wibNowAsStoredDate, wibTodayDateOnly, formatStoredTimeWib } from "@/lib/wib-time";
import { verifyFaceForAttendance } from "@/lib/face-verify";

// Absen mandiri (selfie + lokasi GPS wajib, dicek vs titik lokasi outlet,
// wajah dicocokkan ke foto acuan terdaftar & tidak boleh pakai masker) -
// berdampingan dgn absensi mesin fingerprint yang HR upload (baris
// AttendanceRecord yang sama dipakai keduanya, dibedakan lewat ada/tidaknya
// clockInSelfieUrl/clockOutSelfieUrl). Lokasi di luar radius, wajah tidak
// cocok, atau pakai masker - DITOLAK TOTAL (bukan cuma ditandai).
// Permintaan Kevin 2026-09-17.
export async function GET() {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const today = wibTodayDateOnly();
  const since = new Date(today);
  since.setUTCDate(since.getUTCDate() - 13);

  const [todayRecord, history] = await Promise.all([
    prisma.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId: employee.id, date: today } } }),
    prisma.attendanceRecord.findMany({
      where: { employeeId: employee.id, date: { gte: since, lte: today } },
      orderBy: { date: "desc" },
    }),
  ]);

  const location = await getOutletLocation(employee.outlet);

  return NextResponse.json({
    today: todayRecord,
    history,
    outlet: employee.outlet,
    hasLocationConfigured: !!location,
    radiusMeters: location?.radiusMeters ?? null,
    hasFaceReference: !!employee.faceReferenceUrl,
  });
}

export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const body = await req.json();
  const type = body.type === "in" || body.type === "out" ? body.type : null;
  const selfieUrl = typeof body.selfieUrl === "string" ? body.selfieUrl : "";
  const lat = typeof body.lat === "number" ? body.lat : NaN;
  const lng = typeof body.lng === "number" ? body.lng : NaN;

  if (!type) return NextResponse.json({ error: "Jenis absen tidak valid" }, { status: 400 });
  if (!selfieUrl) return NextResponse.json({ error: "Foto selfie wajib dilampirkan" }, { status: 400 });
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Lokasi GPS wajib diaktifkan - browser tidak mengirim koordinat" }, { status: 400 });
  }
  if (!employee.faceReferenceUrl) {
    return NextResponse.json({ error: "Anda belum mendaftarkan wajah - buka halaman Absensi dan daftarkan wajah dulu." }, { status: 400 });
  }

  const location = await getOutletLocation(employee.outlet);
  if (!location) {
    return NextResponse.json(
      { error: `Titik lokasi untuk outlet "${employee.outlet ?? "-"}" belum diatur di sistem - hubungi HR/Admin.` },
      { status: 400 }
    );
  }
  const distance = distanceMeters(lat, lng, location.lat, location.lng);
  if (distance > location.radiusMeters) {
    return NextResponse.json(
      {
        error: `Anda berada ${Math.round(distance)}m dari lokasi outlet (maksimal ${location.radiusMeters}m). Absen ditolak - pastikan Anda benar-benar berada di lokasi kerja.`,
      },
      { status: 403 }
    );
  }

  let faceCheck;
  try {
    faceCheck = await verifyFaceForAttendance(employee.faceReferenceUrl, selfieUrl);
  } catch (e) {
    // Fail closed - kalau verifikasinya sendiri gagal jalan (API error,
    // dst), absen TETAP ditolak, jangan pernah diloloskan begitu saja.
    return NextResponse.json(
      { error: e instanceof Error ? `Verifikasi wajah gagal (${e.message}) - coba lagi.` : "Verifikasi wajah gagal, coba lagi." },
      { status: 500 }
    );
  }
  if (!faceCheck.faceVisible) {
    return NextResponse.json({ error: `Wajah tidak terlihat jelas di foto - ${faceCheck.reason}. Coba lagi.` }, { status: 400 });
  }
  if (faceCheck.wearingMask) {
    return NextResponse.json(
      { error: "Absen ditolak - peraturan perusahaan tidak memperbolehkan memakai masker saat absen. Lepas masker lalu coba lagi." },
      { status: 403 }
    );
  }
  if (!faceCheck.sameFace || faceCheck.confidence === "rendah") {
    return NextResponse.json(
      { error: `Wajah tidak cocok dengan wajah terdaftar (keyakinan: ${faceCheck.confidence}) - absen ditolak. Kalau ini benar Anda, hubungi HR.` },
      { status: 403 }
    );
  }

  const today = wibTodayDateOnly();
  const now = wibNowAsStoredDate();
  const existing = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date: today } },
  });

  if (type === "in") {
    if (existing?.clockIn) {
      return NextResponse.json({ error: `Sudah absen masuk hari ini pukul ${formatStoredTimeWib(existing.clockIn)}` }, { status: 400 });
    }
    const record = await prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId: employee.id, date: today } },
      create: { employeeId: employee.id, date: today, clockIn: now, clockInSelfieUrl: selfieUrl, clockInLat: lat, clockInLng: lng },
      update: { clockIn: now, clockInSelfieUrl: selfieUrl, clockInLat: lat, clockInLng: lng },
    });
    return NextResponse.json(record, { status: 201 });
  }

  // type === "out"
  if (!existing?.clockIn) {
    return NextResponse.json({ error: "Belum absen masuk hari ini - absen masuk dulu sebelum absen pulang" }, { status: 400 });
  }
  if (existing.clockOut) {
    return NextResponse.json({ error: `Sudah absen pulang hari ini pukul ${formatStoredTimeWib(existing.clockOut)}` }, { status: 400 });
  }
  const record = await prisma.attendanceRecord.update({
    where: { id: existing.id },
    data: { clockOut: now, clockOutSelfieUrl: selfieUrl, clockOutLat: lat, clockOutLng: lng },
  });
  return NextResponse.json(record);
}
