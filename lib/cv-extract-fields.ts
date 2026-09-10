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
