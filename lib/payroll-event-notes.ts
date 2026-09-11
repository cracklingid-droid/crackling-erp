// Kategori catatan kejadian per-tanggal yang otomatis menambah field
// potongan terkait di PayrollItem - dipelajari dari sheet "Hitungan" Kevin
// (kolom Jenis + Keterangan per baris tanggal). Permintaan Kevin 2026-09-11.
export const EVENT_NOTE_CATEGORIES = [
  { key: "kejadian", label: "Pengurangan Dari Kejadian", itemField: "incidentDeduction" },
  { key: "sp", label: "Pemotongan SP", itemField: "warningLetterDeduction" },
  { key: "keterlambatan", label: "Keterlambatan", itemField: "lateDeduction" },
] as const;

export type EventNoteCategory = (typeof EVENT_NOTE_CATEGORIES)[number]["key"];

export function itemFieldForCategory(category: string): string | null {
  return EVENT_NOTE_CATEGORIES.find((c) => c.key === category)?.itemField ?? null;
}

export function labelForCategory(category: string): string {
  return EVENT_NOTE_CATEGORIES.find((c) => c.key === category)?.label ?? category;
}
