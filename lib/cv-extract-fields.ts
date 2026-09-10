// Deteksi email & nomor HP dari teks CV pakai pola sederhana (regex) - hanya
// dua ini yang bisa diandalkan tanpa AI. Nama, alamat, dan tanggal lahir
// butuh pemahaman konteks jadi sengaja tidak dicoba (risiko salah isi lebih
// besar daripada manfaatnya) - keputusan Kevin 2026-09-10.
export function extractContactInfo(text: string): { email: string | null; phone: string | null } {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/(?:\+62|62|0)8[0-9]{2}[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,5}/);

  return {
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0].replace(/[-.\s]/g, "") : null,
  };
}

const NAME_STOPWORDS = /\b(curriculum\s*vitae|daftar\s*riwayat\s*hidup|resume|portfolio|lamaran\s*kerja|surat\s*lamaran|cv)\b/gi;

// Tebak nama dari nama file CV (mis. "CV ZIDANE ELDIO PRATAMA.pdf" -> "Zidane
// Eldio Pratama") - banyak pelamar menamai file CV dengan nama mereka
// sendiri, jadi ini cara murah tanpa AI yang cukup akurat. Balik null kalau
// hasilnya tidak meyakinkan (bukan cuma 1 kata, bukan cuma huruf/spasi),
// daripada salah isi - permintaan Kevin 2026-09-10.
export function guessNameFromFilename(filename: string): string | null {
  let base = filename.replace(/\.(pdf|docx?|rtf)$/i, "");
  base = base.replace(/[_\-.]+/g, " "); // normalisasi pemisah dulu, sebelum cek \b (underscore dianggap huruf oleh regex)
  base = base.replace(NAME_STOPWORDS, " ");
  base = base.replace(/\b(19|20)\d{2}\b/g, " "); // tahun
  base = base.replace(/\b\d+\b/g, " "); // angka lepas (nomor HP, versi, dst)
  base = base.replace(/\s+/g, " ").trim();

  if (base.length < 3 || base.length > 60) return null;
  if (!/^[a-zA-Z .'-]+$/.test(base)) return null;

  const words = base.split(" ").filter(Boolean);
  if (words.length < 2) return null;

  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}
