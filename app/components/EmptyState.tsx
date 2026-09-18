import type { LucideIcon } from "lucide-react";

// Empty state standar - dipakai di halaman/section yang sebelumnya cuma
// menampilkan 1 baris teks abu-abu polos kalau datanya kosong (terasa
// belum jadi/kosong melompong dibanding bagian lain aplikasi yang sudah
// rapi). Beda dari empty state di DALAM tabel (baris "tidak ada data" tetap
// cukup teks polos, tidak perlu dibungkus ini) - ini utk konten
// section/halaman yang areanya cukup luas. Perbaikan UI menyeluruh
// 2026-09-19.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-10 px-6 text-center ${className}`}>
      {Icon && (
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground max-w-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
