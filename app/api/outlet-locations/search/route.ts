import { NextResponse } from "next/server";
import { requireHrWriteUser } from "@/lib/hr-access";

// Cari alamat/nama tempat (searchbar spt Google Maps) - proxy ke Nominatim
// (OpenStreetMap), gratis tanpa API key. Diproxy lewat server (bukan
// dipanggil langsung dari browser) supaya bisa kirim User-Agent yang
// diwajibkan kebijakan pemakaian Nominatim, dan supaya API key/endpoint
// tidak perlu diekspos ke client. Dibatasi ke Indonesia (countrycodes=id)
// biar hasilnya relevan. Permintaan Kevin 2026-09-17.
//
// Link pendek Google Maps (maps.app.goo.gl/...) tidak bisa dibaca koordinat
// dari browser (butuh diikuti redirect-nya dulu, kena CORS kalau dipanggil
// client-side) - jadi diresolve DI SERVER di sini (fetch server-ke-server
// tidak kena CORS), lalu koordinat diambil dari URL final hasil redirect.
// Dites nyata: "https://maps.app.goo.gl/xxx" -> redirect ke
// ".../@lat,lng,17z/data=...!3dlat!4dlng..." - kedua pola (@lat,lng dan
// !3dlat!4dlng) sama-sama diekstrak, saling menguatkan.
const GOOGLE_MAPS_LINK = /^(https?:\/\/)?(www\.)?(maps\.app\.goo\.gl|goo\.gl\/maps|(maps\.)?google\.[a-z.]+\/maps)/i;

function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  let m = url.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (!m) m = url.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (!m) m = url.match(/[?&](?:q|ll)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export async function GET(req: Request) {
  const { error } = await requireHrWriteUser();
  if (error) return error;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json([]);

  if (GOOGLE_MAPS_LINK.test(q)) {
    const target = q.startsWith("http") ? q : `https://${q}`;
    try {
      const res = await fetch(target, {
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      const coords = extractCoordsFromUrl(res.url);
      if (!coords) {
        return NextResponse.json(
          { error: "Link ini tidak mengandung koordinat yang bisa dibaca - coba klik kanan titik lokasinya di Google Maps lalu salin koordinatnya langsung." },
          { status: 422 }
        );
      }
      return NextResponse.json([{ label: `Titik dari link Google Maps (${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)})`, lat: coords.lat, lng: coords.lng }]);
    } catch {
      return NextResponse.json({ error: "Gagal membuka link Google Maps" }, { status: 502 });
    }
  }

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
