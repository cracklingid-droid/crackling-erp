import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHrWriteUser } from "@/lib/hr-access";
import { ATTENDANCE_OUTLETS } from "@/lib/outlet-locations";

// Titik lokasi (lat/lng) + radius per outlet utk validasi absen mandiri
// selfie+lokasi Portal Karyawan - diatur HR dari HP saat berdiri di
// outletnya (tombol "Gunakan Lokasi Saat Ini" di
// /hr/payroll/absensi/lokasi). Permintaan Kevin 2026-09-17.
export async function GET() {
  const { error } = await requireHrWriteUser();
  if (error) return error;

  const rows = await prisma.outletLocation.findMany({ include: { updatedBy: { select: { name: true } } } });
  const byOutlet = new Map(rows.map((r) => [r.outlet, r]));

  const result = ATTENDANCE_OUTLETS.map((outlet) => {
    const row = byOutlet.get(outlet);
    return row
      ? {
          outlet,
          lat: row.lat,
          lng: row.lng,
          radiusMeters: row.radiusMeters,
          updatedAt: row.updatedAt,
          updatedByName: row.updatedBy?.name ?? null,
        }
      : { outlet, lat: null, lng: null, radiusMeters: 50, updatedAt: null, updatedByName: null };
  });
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { user, error } = await requireHrWriteUser();
  if (error) return error;

  const body = await req.json();
  const outlet = typeof body.outlet === "string" ? body.outlet : "";
  const lat = typeof body.lat === "number" ? body.lat : NaN;
  const lng = typeof body.lng === "number" ? body.lng : NaN;
  const radiusMeters = Number.isFinite(Number(body.radiusMeters)) ? Math.round(Number(body.radiusMeters)) : 50;

  if (!ATTENDANCE_OUTLETS.includes(outlet)) {
    return NextResponse.json({ error: "Outlet tidak dikenali" }, { status: 400 });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Koordinat lokasi tidak valid - aktifkan GPS lalu coba lagi" }, { status: 400 });
  }
  if (radiusMeters < 10 || radiusMeters > 1000) {
    return NextResponse.json({ error: "Radius harus antara 10-1000 meter" }, { status: 400 });
  }

  const row = await prisma.outletLocation.upsert({
    where: { outlet },
    create: { outlet, lat, lng, radiusMeters, updatedById: user.id },
    update: { lat, lng, radiusMeters, updatedById: user.id },
  });
  return NextResponse.json(row);
}
