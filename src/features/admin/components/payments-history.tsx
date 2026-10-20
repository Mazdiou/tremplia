"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { callApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  formatEndDate,
  platformPaymentAmountLabel,
  platformPaymentMethodLabel,
} from "@/features/subscription/subscription";
import { TextField } from "@/components/form-fields";

type HistoryPayment = {
  id: string;
  months: number;
  amount: number;
  method: string;
  note: string | null;
  recordedLabel: string;
  newEndsAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
};

// Historique des paiements d'une agence, du plus récent au plus ancien.
// Seul le dernier paiement non annulé peut être annulé (erreur de saisie).
export function PaymentsHistory({ payments }: { payments: HistoryPayment[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<HistoryPayment | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastValid = payments.find((p) => !p.cancelledAt)?.id;

  async function cancel() {
    if (!target) return;
    setBusy(true);
    setError(null);
    const res = await callApi(`/api/admin/payments/${target.id}/cancel`, { body: { reason } });
    setBusy(false);
    if (!res.ok) {
      setError(res.fieldErrors.reason ?? res.error);
      return;
    }
    setTarget(null);
    setReason("");
    router.refresh();
  }

  if (payments.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        Aucun paiement enregistré.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y rounded-2xl border bg-card text-sm">
        {payments.map((p) => (
          <li
            key={p.id}
            className={cn(
              "flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3",
              p.cancelledAt && "text-muted-foreground",
            )}
          >
            <span className="w-24 tabular-nums">{p.recordedLabel}</span>
            <span className={cn("w-28 font-medium", p.cancelledAt && "line-through")}>
              {platformPaymentAmountLabel(p)}
            </span>
            <span className="min-w-0 flex-1">
              {p.months} mois
              {p.method !== "gift" && ` · ${platformPaymentMethodLabel(p.method)}`}
              {p.note && <span className="text-muted-foreground"> · {p.note}</span>}
              {p.cancelledAt ? (
                <span className="block text-xs">Annulé : {p.cancelReason}</span>
              ) : (
                <span className="block text-xs text-muted-foreground">
                  Fin portée au {formatEndDate(p.newEndsAt)}
                </span>
              )}
            </span>
            {p.id === lastValid && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setError(null);
                  setReason("");
                  setTarget(p);
                }}
              >
                Annuler ce paiement
              </Button>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={target !== null}
        title="Annuler ce paiement ?"
        body={
          error ??
          "La fin d'abonnement reviendra à celle d'avant ce paiement. Le paiement reste visible, barré, avec le motif."
        }
        confirmLabel="Annuler le paiement"
        cancelLabel="Garder"
        danger
        loading={busy}
        confirmDisabled={reason.trim() === ""}
        onConfirm={() => void cancel()}
        onCancel={() => setTarget(null)}
      >
        <TextField
          id="cancel-reason"
          label="Motif"
          maxLength={300}
          value={reason}
          onChange={setReason}
          placeholder="Ex. : erreur de montant"
        />
      </ConfirmDialog>
    </>
  );
}
