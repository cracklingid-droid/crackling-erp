const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Format nama file slip gaji: "YYMM-Gaji NAMA BulanLengkap.pdf" - YY/MM &
// nama bulan diambil dari tanggal AKHIR periode (bulan pencairan gaji,
// sesuai kebiasaan Kevin menyebut periode 25 Jul-24 Agu sbg "gaji
// Agustus"). Permintaan Kevin 2026-09-11.
export function payslipFilename(periodEndDate: Date, employeeName: string): string {
  const yy = String(periodEndDate.getFullYear() % 100).padStart(2, "0");
  const mm = String(periodEndDate.getMonth() + 1).padStart(2, "0");
  const monthName = MONTH_NAMES_ID[periodEndDate.getMonth()];
  const safeName = employeeName.replace(/[\\/:*?"<>|]/g, "").trim();
  return `${yy}${mm}-Gaji ${safeName} ${monthName}.pdf`;
}

export function payslipZipFilename(periodEndDate: Date, category: string): string {
  const yy = String(periodEndDate.getFullYear() % 100).padStart(2, "0");
  const mm = String(periodEndDate.getMonth() + 1).padStart(2, "0");
  const monthName = MONTH_NAMES_ID[periodEndDate.getMonth()];
  const categoryLabel = category === "outlet" ? "Outlet" : "Kantor";
  return `${yy}${mm}-Slip Gaji ${categoryLabel} ${monthName}.zip`;
}
