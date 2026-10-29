"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AmountField, SelectField, TextField, optionsOf } from "@/components/form-fields";
import { callApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { PLATFORM_PAYMENT_METHOD_LABELS, formatEndDate } from "@/features/subscription/subscription";
import {
  PLATFORM_PAYMENT_METHODS,
  SUBSCRIPTION_MONTHS,
  newEndDate,
  type SubscriptionMonths,
} from "../schemas";
import { useModalDialog } from "@/hooks/use-modal-dialog";

const methodOptions = optionsOf(PLATFORM_PAYMENT_METHODS, PLATFORM_PAYMENT_METHOD_LABELS);

type DialogAgency = { id: string; name: string; endsAt: string };

// Fenêtre « Paiement reçu » : durée, montant, moyen et note ; la nouvelle
// date de fin s'affiche avant d'enregistrer. En mode « Offrir des mois »
// (gift), ni montant ni moyen : seulement la durée et le motif, obligatoire.
function PaymentDialog({
  agency,
  gift,
  open,
  onClose,
}: {
  agency: DialogAgency;
  gift: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useModalDialog(open);
  // Les deux fenêtres d'une même agence peuvent être sur la page
  const idPrefix = `${gift ? "gift" : "payment"}-${agency.id}`;
  const [months, setMonths] = useState<SubscriptionMonths>(12);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function save() {
    setSaving(true);
    setError(null);
    const res = gift
      ? await callApi(`/api/admin/agencies/${agency.id}/gifts`, { body: { months, note } })
      : await callApi(`/api/admin/agencies/${agency.id}/payments`, {
          body: { months, amount, method, note },
        });
    setSaving(false);
    if (!res.ok) {
      setFieldErrors(res.fieldErrors);
      if (Object.keys(res.fieldErrors).length === 0) setError(res.error);
      return;
    }
    setAmount("");
    setNote("");
    setFieldErrors({});
    onClose();
    router.refresh();
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby={`${idPrefix}-title`}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-2xl border bg-card p-5 text-card-foreground backdrop:bg-black/45"
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-4"
      >
        <h2 id={`${idPrefix}-title`} className="text-base font-semibold">
          {gift ? "Offrir des mois" : "Paiement reçu"}
          <span className="block text-sm font-normal text-muted-foreground">{agency.name}</span>
        </h2>
        {gift && (
          <p className="text-sm text-muted-foreground">
            L&apos;abonnement est prolongé sans paiement, et noté « Offert » dans l&apos;historique.
          </p>
        )}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Durée</legend>
          <div className="flex gap-2">
            {SUBSCRIPTION_MONTHS.map((m) => (
              <label
                key={m}
                className={cn(
                  "flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  months === m && "border-primary bg-primary/10 font-medium text-link",
                )}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-months`}
                  value={m}
                  checked={months === m}
                  onChange={() => setMonths(m)}
                  className="sr-only"
                />
                {m} mois
              </label>
            ))}
          </div>
        </fieldset>

        {gift ? (
          <TextField id={`${idPrefix}-note`} label="Motif" required maxLength={300} value={note}
            onChange={setNote} placeholder="Ex. : partenaire, geste commercial"
            error={fieldErrors.note} />
        ) : (
          <>
            <AmountField id={`${idPrefix}-amount`} label="Montant" required value={amount}
              onChange={setAmount} error={fieldErrors.amount} />
            <SelectField id={`${idPrefix}-method`} label="Moyen" required value={method}
              onChange={setMethod} options={methodOptions} error={fieldErrors.method} />
            <TextField id={`${idPrefix}-note`} label="Note" maxLength={300} value={note}
              onChange={setNote} placeholder="Ex. : reçu n° 12" hint="Facultatif"
              error={fieldErrors.note} />
          </>
        )}

        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          Nouvelle fin :{" "}
          <span className="font-semibold">
            {formatEndDate(newEndDate(agency.endsAt, months).toISOString())}
          </span>
        </p>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Patientez…" : gift ? "Offrir" : "Enregistrer"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

// Bouton qui ouvre la fenêtre « Paiement reçu »
export function PaymentButton({
  agency,
  variant = "outline",
}: {
  agency: DialogAgency;
  variant?: "outline" | "default";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
        Paiement reçu
      </Button>
      <PaymentDialog agency={agency} gift={false} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// Bouton qui ouvre la fenêtre « Offrir des mois »
export function GiftButton({
  agency,
  variant = "outline",
}: {
  agency: DialogAgency;
  variant?: "outline" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
        <Gift aria-hidden />
        Offrir des mois
      </Button>
      <PaymentDialog agency={agency} gift open={open} onClose={() => setOpen(false)} />
    </>
  );
}
