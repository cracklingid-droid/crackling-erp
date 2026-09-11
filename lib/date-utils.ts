// Format Date jadi "YYYY-MM-DD" pakai komponen tanggal LOKAL (bukan
// d.toISOString().slice(0,10), yang membaca komponen UTC dan bisa geser
// mundur 1 hari untuk timezone yang lebih maju dari UTC seperti WIB/+7 -
// mis. tengah malam lokal 21 Agustus = 17:00 UTC tanggal 20). Dipakai di
// mana pun butuh ubah Date -> string tanggal kalender yang dilihat user.
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
