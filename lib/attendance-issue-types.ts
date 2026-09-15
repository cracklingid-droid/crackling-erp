// Konstanta murni fitur "Absen Perlu Dicek" (tanpa import prisma/next) -
// aman dipakai di client component (lonceng header, halaman daftar) MAUPUN
// server (lib/attendance-issues.ts). Pola pemisahan sama dgn lib/roles.ts.

export const ATTENDANCE_ISSUE_TYPES = ["lupa_tap_in", "lupa_tap_out", "tidak_absen"] as const;
export type AttendanceIssueType = (typeof ATTENDANCE_ISSUE_TYPES)[number];

export const ATTENDANCE_ISSUE_LABELS: Record<AttendanceIssueType, string> = {
  lupa_tap_in: "Lupa tap in",
  lupa_tap_out: "Lupa tap out",
  tidak_absen: "Tidak absen",
};

// Status yang dipilih HR kalau masalahnya BUKAN diselesaikan dgn isi jam
// manual (mis. karyawan memang izin/sakit) - masalah dianggap selesai &
// hilang dari lonceng, tapi tetap bisa dilihat/dibatalkan di halaman daftar.
export const ISSUE_RESOLUTION_STATUSES = ["izin", "sakit", "cuti", "diabaikan"] as const;
export type IssueResolutionStatus = (typeof ISSUE_RESOLUTION_STATUSES)[number];

export const ISSUE_RESOLUTION_LABELS: Record<IssueResolutionStatus, string> = {
  izin: "Izin",
  sakit: "Sakit",
  cuti: "Cuti",
  diabaikan: "Diabaikan",
};

// Mesin fingerprint menyimpan scan tunggal sbg jam masuk = jam pulang (lihat
// lib/attendance-parse.ts). Scan tunggal SEBELUM jam ini dianggap jam masuk
// (berarti lupa tap out), sesudahnya dianggap jam pulang (lupa tap in) -
// keputusan 2026-09-15.
export const SINGLE_SCAN_CUTOFF_HOUR = 14;

// Event browser supaya lonceng header langsung update begitu HR import absen
// atau menyelesaikan masalah, tanpa nunggu refresh berkala.
export const ATTENDANCE_ISSUES_CHANGED_EVENT = "attendance-issues-changed";

export function notifyAttendanceIssuesChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ATTENDANCE_ISSUES_CHANGED_EVENT));
}
