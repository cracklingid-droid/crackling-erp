// Prefiks kode ID karyawan otomatis per outlet - dikonfirmasi Kevin
// 2026-09-12. Format: "<PREFIX>-0001", nomor urut naik terus per prefiks
// (tidak dipakai ulang meski karyawan resign).
export const OUTLET_CODE_PREFIXES: Record<string, string> = {
  "Gading Serpong": "GS",
  "Kelapa Gading": "KG",
  "Joglo (Central Kitchen)": "JO",
  Fatgai: "FG",
};

export function prefixForOutlet(outlet: string | null | undefined): string | null {
  if (!outlet) return null;
  return OUTLET_CODE_PREFIXES[outlet] ?? null;
}
