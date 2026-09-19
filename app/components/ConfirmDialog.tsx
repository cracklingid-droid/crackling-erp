"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Dialog konfirmasi standar utk aksi yang tidak bisa dibatalkan (hapus,
// reset, finalisasi). Menggantikan window.confirm() (tampilan bawaan
// browser, beda-beda tiap OS) dan aksi hapus yang sebelumnya langsung jalan
// tanpa konfirmasi. Tombol konfirmasi otomatis `destructive` kalau
// `destructive` true. Perbaikan UI menyeluruh 2026-09-19.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Ya, lanjutkan",
  cancelLabel = "Batal",
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={destructive ? "destructive" : "default"} onClick={handleConfirm} disabled={busy}>
            {busy ? "Memproses..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper state supaya pemakaian di halaman ringkas:
//   const confirm = useConfirm();
//   <Button onClick={() => confirm.ask({ title, onConfirm })} />
//   <ConfirmDialog {...confirm.props} />
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    description?: React.ReactNode;
    confirmLabel?: string;
    destructive?: boolean;
    onConfirm: () => void | Promise<void>;
  }>({ open: false, title: "", onConfirm: () => {} });

  return {
    ask(opts: Omit<typeof state, "open">) {
      setState({ ...opts, open: true });
    },
    props: {
      ...state,
      onOpenChange: (open: boolean) => setState((s) => ({ ...s, open })),
    },
  };
}
