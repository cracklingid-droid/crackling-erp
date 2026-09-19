// Penanda field wajib di label form - sebelumnya hampir tidak ada field
// yang ditandai padahal ditolak saat submit (user baru tahu setelah klik
// Simpan). Perbaikan UI menyeluruh 2026-09-19.
export function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      {" "}*
    </span>
  );
}
