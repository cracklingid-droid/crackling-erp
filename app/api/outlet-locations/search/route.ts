import { NextResponse } from "next/server";
import { requireHrWriteUser } from "@/lib/hr-access";

// Cari alamat/nama tempat (searchbar spt Google Maps) - proxy ke Nominatim
// (OpenStreetMap), gratis tanpa API key. Diproxy lewat server (bukan
// dipanggil langsung dari browser) supaya bisa kirim User-Agent yang
// diwajibkan kebijakan pemakaian Nominatim, dan supaya API key/endpoint
// tidak perlu diekspos ke client. Dibatasi ke Indonesia (countrycodes=id)
// biar hasilnya relevan. Permintaan Kevin 2026-09-17.
export async function GET(req: Request) {
  const { error } = await requireHrWriteUser();
  if (error) return error;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json([]);

  const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=id&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(nominatimUrl, {
      headers: { "User-Agent": "CracklingERP/1.0 (HR attendance location setup; contact: cracklingid@gmail.com)" },
    });
    if (!res.ok) return NextResponse.json({ error: "Gagal mencari lokasi" }, { status: 502 });
    const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
    return NextResponse.json(data.map((d) => ({ label: d.display_name, lat: Number(d.lat), lng: Number(d.lon) })));
  } catch {
    return NextResponse.json({ error: "Gagal menghubungi layanan pencarian lokasi" }, { status: 502 });
  }
}
