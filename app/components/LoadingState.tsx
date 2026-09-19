import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Loading state standar - sebelumnya 28 tempat cuma menulis teks "Memuat..."
// polos (halaman terasa kosong/hang sesaat, lalu layout "melompat" begitu
// data datang). Tiga bentuk:
// - "page"    : skeleton bentuk halaman (judul + baris + kartu) utk halaman
//               detail/list yang seluruh isinya menunggu data.
// - "section" : beberapa baris skeleton utk 1 bagian/list di dalam halaman.
// - "screen"  : spinner di tengah layar penuh utk gerbang auth/halaman
//               publik yang belum tahu mau render apa.
// Semua diberi role="status" + teks utk screen reader. Perbaikan UI
// menyeluruh 2026-09-19.
export function LoadingState({
  variant = "page",
  label = "Memuat...",
  rows = 3,
  className = "",
}: {
  variant?: "page" | "section" | "screen";
  label?: string;
  rows?: number;
  className?: string;
}) {
  if (variant === "screen") {
    return (
      <div role="status" aria-live="polite" className={`flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" /> {label}
      </div>
    );
  }
  if (variant === "section") {
    return (
      <div role="status" aria-live="polite" className={`grid gap-2 ${className}`}>
        <span className="sr-only">{label}</span>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  return (
    <div role="status" aria-live="polite" className={`grid gap-6 ${className}`}>
      <span className="sr-only">{label}</span>
      <div className="grid gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-3 rounded-xl border p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-2/3" />
      </div>
    </div>
  );
}
