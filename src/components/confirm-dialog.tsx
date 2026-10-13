"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

// Boîte de confirmation : <dialog> natif (Échap, focus piégé, fond grisé).
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onClick={(e) => e.target === ref.current && onCancel()}
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl border bg-card p-5 text-card-foreground backdrop:bg-black/45"
    >
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Annuler
        </Button>
        <Button
          variant={danger ? "destructive" : "default"}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? "Patientez..." : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
