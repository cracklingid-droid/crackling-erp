// Format uang standar seluruh aplikasi - sebelumnya ada 8 salinan lokal
// yang sedikit beda-beda ("Rp" vs "Rp " pakai spasi, ada yang bulatkan ada
// yang tidak, dan angka negatif jadi "Rp-53.333"). Satu sumber: tanpa spasi,
// dibulatkan, tanda minus di DEPAN "Rp" ("-Rp53.333"). Perbaikan UI
// menyeluruh 2026-09-19.
export function formatRupiah(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}Rp${Math.round(Math.abs(n)).toLocaleString("id-ID")}`;
}
