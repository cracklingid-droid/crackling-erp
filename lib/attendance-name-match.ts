// Pencocokan nama dari laporan mesin absensi ke Database Karyawan - dulu
// cuma exact-match (trim+lowercase), jadi typo/nama panggilan kecil (mis.
// mesin tulis "ahmad" utk "Ahmad Yani", "audi" utk "Audy", "titus" utk
// "Titus Wegi Ziraluo") bikin absennya gagal terimpor tanpa ada saran
// perbaikan - HR baru tahu SETELAH klik Import lewat daftar "nama tidak
// terbaca". Modul ini nyari kandidat karyawan yang paling mirip (exact
// match penuh/kata, atau fuzzy Levenshtein) supaya bisa ditawarkan sbg
// SARAN saat preview (sebelum Import), dikonfirmasi 1x oleh HR, lalu
// disimpan sbg alias permanen (AttendanceNameAlias) - upload berikutnya
// otomatis kebaca tanpa perlu dikonfirmasi ulang. Permintaan Kevin
// 2026-09-12.

export type EmployeeForMatching = { id: number; name: string };

export type NameMatchStatus = "exact" | "alias" | "suggested" | "none";

export type NameMatchSuggestion = { employeeId: number; employeeName: string; score: number };

export type NameMatchResult = {
  name: string; // nama mentah dari mesin absen, apa adanya
  status: NameMatchStatus;
  employeeId: number | null; // terisi kalau status "exact"/"alias"
  employeeName: string | null;
  suggestions: NameMatchSuggestion[]; // terisi kalau status "suggested" (butuh konfirmasi HR)
};

export function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

// 1.0 = identik, 0.0 = sama sekali tidak mirip.
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// Skor kemiripan 1 nama mentah ke 1 karyawan - dibandingkan ke nama penuh
// DAN ke tiap kata dalam nama itu (mis. "titus" vs "Titus Wegi Ziraluo"
// bakal cocok exact ke kata pertama walau beda total ke nama penuhnya).
function bestScoreForEmployee(rawNormalized: string, employeeName: string): number {
  const empNormalized = normalizeName(employeeName);
  let best = similarity(rawNormalized, empNormalized);
  for (const token of empNormalized.split(" ")) {
    best = Math.max(best, similarity(rawNormalized, token));
  }
  return best;
}

const SUGGESTION_MIN_SCORE = 0.5;
const MAX_SUGGESTIONS = 3;

export function suggestEmployeeMatches(rawName: string, employees: EmployeeForMatching[]): NameMatchSuggestion[] {
  const rawNormalized = normalizeName(rawName);
  return employees
    .map((e) => ({ employeeId: e.id, employeeName: e.name, score: bestScoreForEmployee(rawNormalized, e.name) }))
    .filter((c) => c.score >= SUGGESTION_MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS);
}

// Cocokkan 1 nama mentah dari mesin absen: exact match nama karyawan ->
// alias yang sudah dikonfirmasi HR sebelumnya -> saran fuzzy (butuh
// konfirmasi) -> tidak ada kandidat sama sekali.
export function matchAttendanceName(
  rawName: string,
  employees: EmployeeForMatching[],
  aliasByMachineName: Map<string, number>
): NameMatchResult {
  const rawNormalized = normalizeName(rawName);
  const empByNormalizedName = new Map(employees.map((e) => [normalizeName(e.name), e]));

  const exact = empByNormalizedName.get(rawNormalized);
  if (exact) {
    return { name: rawName, status: "exact", employeeId: exact.id, employeeName: exact.name, suggestions: [] };
  }

  const aliasEmployeeId = aliasByMachineName.get(rawNormalized);
  if (aliasEmployeeId != null) {
    const emp = employees.find((e) => e.id === aliasEmployeeId);
    return { name: rawName, status: "alias", employeeId: aliasEmployeeId, employeeName: emp?.name ?? null, suggestions: [] };
  }

  const suggestions = suggestEmployeeMatches(rawName, employees);
  if (suggestions.length > 0) {
    return { name: rawName, status: "suggested", employeeId: null, employeeName: null, suggestions };
  }

  return { name: rawName, status: "none", employeeId: null, employeeName: null, suggestions: [] };
}
