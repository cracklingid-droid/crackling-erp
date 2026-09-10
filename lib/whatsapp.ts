// Ubah nomor HP lokal (08xx...) jadi format internasional (628xx...) yang
// dibutuhkan wa.me - kalau sudah 62xx atau format lain dibiarkan apa adanya
// (selain buang karakter non-digit).
export function toWaNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (!digits.startsWith("62")) return "62" + digits;
  return digits;
}

export function buildWaLink(phone: string, message: string): string {
  return `https://wa.me/${toWaNumber(phone)}?text=${encodeURIComponent(message)}`;
}
