import { OUTLET_NAMES } from "./payroll-config";
import { toLocalDateString } from "./date-utils";

// Slug pendek per outlet buat link publik roster ("papan roster bersama" -
// dibagikan HR ke grup WA outlet, jadi sengaja pakai slug yang gampang
// diketik/dibaca, bukan token acak - permintaan Kevin 2026-09-11).
export const OUTLET_SLUGS: Record<string, string> = {
  "Joglo (Central Kitchen)": "joglo",
  "Gading Serpong": "gading-serpong",
  "Kelapa Gading": "kelapa-gading",
  Fatgai: "fatgai",
};

export function outletToSlug(outlet: string): string | null {
  return OUTLET_SLUGS[outlet] ?? null;
}

export function slugToOutlet(slug: string): string | null {
  const found = Object.entries(OUTLET_SLUGS).find(([, s]) => s === slug);
  return found ? found[0] : null;
}

export const ROSTER_OUTLETS = OUTLET_NAMES;

const DAY_LABELS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

// Senin s.d. Minggu - standar minggu kerja Indonesia. `anchor` boleh
// tanggal apapun di minggu itu, hasilnya selalu mulai hari Senin.
export function getWeekDates(anchor: Date = new Date()): Date[] {
  const dow = anchor.getDay(); // 0=Minggu..6=Sabtu
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + diffToMonday);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
}

export function addWeeks(anchor: Date, weeks: number): Date {
  return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + weeks * 7);
}

export function formatDayLabel(d: Date): string {
  return `${DAY_LABELS[d.getDay()]}, ${d.getDate()} ${d.toLocaleDateString("id-ID", { month: "short" })}`;
}

export { toLocalDateString as dateKey };
