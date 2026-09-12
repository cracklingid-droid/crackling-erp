// Jadwal periode Payroll Outlet TETAP, ikut persis pengumuman resmi Kevin
// di grup ("Crackling Operations Announcements", 2026-09-12): rentang
// tanggal TIDAK BOLEH dikustomisasi lagi oleh HR - supaya tidak ada ruang
// salah input. Cukup 1 tombol "Buat Periode Berikutnya", tanggalnya
// dihitung sistem dari periode outlet terakhir.
//
// Pengumumannya:
//   Agustus   : 26 Jul - 24 Agu 2026
//   September : 25 Agu - 23 Sep 2026
//   Oktober   : 24 Sep - 22 Okt 2026
//   November  : 23 Okt - 21 Nov 2026
//   Desember  : 22 Nov - 20 Des 2026
//   "Seterusnya tanggal cut off akan menjadi tanggal 21-20" (mulai Jan 2027)
//   Gaji tetap dibayarkan tanggal 25.
//
// Pola di atas ternyata 1 rumus berulang: periode berikutnya selalu mulai
// tepat 1 hari setelah periode sebelumnya berakhir, dan tanggal akhirnya
// turun 1 hari tiap periode sampai mentok di tanggal 20 (lalu menetap di
// 20 selamanya) - jadi TIDAK PERLU tabel hardcode, cukup fungsi rekursif
// dari periode terakhir yang ada. Kevin sudah minta ini berlaku mulai
// periode BERIKUTNYA (periode "25 Jul - 24 Agu 2026" yang sudah ada di
// sistem dibiarkan apa adanya, beda 1 hari dari pengumuman) - keputusan
// 2026-09-12.
export function nextOutletPeriodRange(previousEnd: Date): { start: Date; end: Date } {
  const start = new Date(previousEnd.getFullYear(), previousEnd.getMonth(), previousEnd.getDate() + 1);
  const endDay = Math.max(20, previousEnd.getDate() - 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, endDay);
  return { start, end };
}

// Label dilabeli bulan tanggal akhir siklus (itu bulan gajiannya, tanggal
// 25) - sama konvensi dgn defaultPeriodLabel yang sudah ada, tapi outlet
// sekarang generate label ini sendiri (tidak lagi diketik manual HR).
export function outletPeriodLabel(end: Date): string {
  const monthLabel = end.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  return `Gaji Outlet ${monthLabel}`;
}
