import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./EmptyState";

// Error state standar utk data halaman yang gagal dimuat - dipakai bareng
// readJson() (lib/fetch-json.ts). Selalu kasih jalan keluar ("Coba lagi"),
// jangan cuma bilang gagal. Perbaikan UI menyeluruh 2026-09-19.
export function ErrorState({ message, onRetry, className }: { message?: string; onRetry?: () => void; className?: string }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Gagal memuat data"
      description={message ?? "Periksa koneksi internet Anda, lalu coba lagi."}
      className={className}
      action={
        onRetry && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Coba lagi
          </Button>
        )
      }
    />
  );
}
