"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Banknote, Loader2, Pencil, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusPill, type PillTone } from "@/components/page-ui";
import {
  AmountField,
  SelectField,
  TextAreaField,
  TextField,
  optionsOf,
} from "@/components/form-fields";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  paymentMethodLabel,
  paymentSummary,
  type PaymentState,
} from "@/features/payments/schemas";
import { callApi } from "@/lib/api-client";
import { dateTimeFormat, formatLongDate, todayInAppTimezone } from "@/lib/dates";
import { amountInputValue, formatDA, parseAmount } from "@/lib/money";
import { cn } from "@/lib/utils";

export type PaymentRow = {
  id: string;
  amount: number;
  paidOn: string;
  method: string;
  note: string | null;
  createdBy: string;
  cancelled: { by: string; at: string; reason: string } | null;
};

type Message = { text: string; error: boolean } | null;

const methodOptions = optionsOf(PAYMENT_METHODS, PAYMENT_METHOD_LABELS);

const PAYMENT_STATE_PILL: Record<PaymentState, { tone: PillTone; label: string }> = {
  unset: { tone: "off", label: "Montant à fixer" },
  unpaid: { tone: "warn", label: "Rien payé" },
  partial: { tone: "warn", label: "Paiement partiel" },
  paid: { tone: "ok", label: "Soldé" },
};

// Montant convenu : saisie (première fois, ou modification par le patron)
function AgreedAmountForm({
  caseId,
  initial,
  submitLabel,
  onDone,
  onCancel,
}: {
  caseId: string;
  initial: number | null;
  submitLabel: string;
  onDone: (message: string) => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(amountInputValue(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(undefined);
    const res = await callApi(`/api/cases/${caseId}/payments/agreed-amount`, {
      method: "PUT",
      body: { amount: value },
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.fieldErrors.amount ?? res.error);
      return;
    }
    onDone("Montant convenu enregistré");
  }

  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      onKeyDown={(e) => e.key === "Escape" && onCancel?.()}
      className="flex flex-wrap items-start gap-2"
    >
      <AmountField
        id="agreed-amount"
        label="Montant convenu"
        required
        value={value}
        onChange={setValue}
        error={error}
        autoFocus={onCancel !== undefined}
        className="w-full max-w-xs"
      />
      <div className="flex gap-2 sm:mt-6">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}

function Figure({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 text-2xl font-semibold tracking-tight tabular-nums", className)}>
        {value}
      </dd>
    </div>
  );
}

// Nouveau paiement : montant (au plus le reste à payer), date, moyen, note
function PaymentForm({
  caseId,
  remaining,
  onDone,
  onCancel,
}: {
  caseId: string;
  remaining: number;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(todayInAppTimezone());
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setError(null);
    const parsed = parseAmount(amount);
    if (parsed !== null && parsed > remaining) {
      setErrors({ amount: `Le reste à payer est de ${formatDA(remaining)}` });
      return;
    }
    setSaving(true);
    const res = await callApi(`/api/cases/${caseId}/payments`, {
      body: { amount, paidOn, method, note },
    });
    setSaving(false);
    if (!res.ok) {
      setErrors(res.fieldErrors);
      if (Object.keys(res.fieldErrors).length === 0) setError(res.error);
      return;
    }
    onDone(
      parsed === remaining
        ? `Paiement de ${formatDA(parsed)} enregistré : le dossier est soldé`
        : `Paiement de ${formatDA(parsed ?? 0)} enregistré`,
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      className="space-y-4 rounded-xl border bg-card p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <AmountField
            id="payment-amount"
            label="Montant payé"
            required
            autoFocus
            value={amount}
            onChange={setAmount}
            error={errors.amount}
          />
          {!errors.amount && (
            <p className="text-xs text-muted-foreground">
              Reste à payer : {formatDA(remaining)} ·{" "}
              <button
                type="button"
                className="font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => setAmount(amountInputValue(remaining))}
              >
                Tout régler
              </button>
            </p>
          )}
        </div>
        <TextField
          id="payment-date"
          label="Date du paiement"
          type="date"
          required
          value={paidOn}
          onChange={setPaidOn}
          error={errors.paidOn}
        />
        <SelectField
          id="payment-method"
          label="Moyen de paiement"
          required
          value={method}
          onChange={setMethod}
          options={methodOptions}
          error={errors.method}
        />
        <TextField
          id="payment-note"
          label="Note"
          maxLength={300}
          value={note}
          onChange={setNote}
          placeholder="Ex. : référence du virement"
          hint="Facultatif"
          error={errors.note}
        />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {error && (
          <p role="alert" className="mr-auto text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          Enregistrer le paiement
        </Button>
      </div>
    </form>
  );
}

function PaymentLine({
  payment,
  canCancel,
  onCancel,
}: {
  payment: PaymentRow;
  canCancel: boolean;
  onCancel: () => void;
}) {
  const cancelled = payment.cancelled;
  return (
    <li className={cn("flex items-start gap-3 px-4 py-3", cancelled && "bg-muted/40")}>
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
          cancelled ? "bg-muted text-muted-foreground" : "bg-success-bg text-success",
        )}
      >
        <Banknote className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              "font-semibold tabular-nums",
              cancelled && "text-muted-foreground line-through",
            )}
          >
            {formatDA(payment.amount)}
          </span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {paymentMethodLabel(payment.method)}
          </span>
          {cancelled && <StatusPill tone="bad">Annulé</StatusPill>}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {formatLongDate(payment.paidOn)} · enregistré par {payment.createdBy}
        </p>
        {payment.note && <p className="mt-1 text-sm break-words">{payment.note}</p>}
        {cancelled && (
          <p className="mt-1 text-sm break-words text-muted-foreground">
            Annulé par {cancelled.by} le {dateTimeFormat.format(new Date(cancelled.at))} :{" "}
            <span className="text-foreground">{cancelled.reason}</span>
          </p>
        )}
      </div>
      {canCancel && !cancelled && (
        <Button
          variant="ghost"
          size="icon-sm"
          title="Annuler ce paiement"
          aria-label={`Annuler le paiement de ${formatDA(payment.amount)}`}
          className="text-muted-foreground hover:text-destructive"
          onClick={onCancel}
        >
          <Ban />
        </Button>
      )}
    </li>
  );
}

export function PaymentsPanel({
  caseId,
  agreed,
  paid,
  payments,
  isOwner,
  defaultFee,
}: {
  caseId: string;
  agreed: number | null;
  // Total des paiements non annulés, tenu par la base
  paid: number;
  payments: PaymentRow[];
  isOwner: boolean;
  // Tarif de la campagne, proposé quand le montant n'est pas encore fixé
  defaultFee: number | null;
}) {
  const router = useRouter();
  const summary = paymentSummary(agreed, paid);
  const pill = PAYMENT_STATE_PILL[summary.state];

  const [mode, setMode] = useState<"idle" | "pay" | "agreed">("idle");
  const [message, setMessage] = useState<Message>(null);
  const [toCancel, setToCancel] = useState<PaymentRow | null>(null);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  function done(text: string) {
    setMode("idle");
    setMessage({ text, error: false });
    router.refresh();
  }

  async function cancel() {
    if (!toCancel) return;
    setCancelling(true);
    const res = await callApi(`/api/cases/${caseId}/payments/${toCancel.id}/cancel`, {
      body: { reason },
    });
    setCancelling(false);
    setToCancel(null);
    setMessage(
      res.ok ? { text: "Paiement annulé", error: false } : { text: res.error, error: true },
    );
    router.refresh();
  }

  const canPay = summary.remaining !== null && summary.remaining > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Paiements</h2>
          <p className="text-sm text-muted-foreground">
            Ce que le candidat a réglé à l&apos;agence
          </p>
        </div>
        {canPay && mode !== "pay" && (
          <Button
            onClick={() => {
              setMessage(null);
              setMode("pay");
            }}
          >
            <Plus /> Enregistrer un paiement
          </Button>
        )}
      </div>

      {agreed === null ? (
        <section className="rounded-2xl border border-dashed bg-card p-5">
          <div className="flex items-start gap-3">
            <Wallet className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <p className="text-sm font-medium">Montant convenu non fixé</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Indiquez ce que le candidat doit à l&apos;agence pour suivre ses paiements.
                  {!isOwner && " Une fois fixé, seul le patron pourra le modifier."}
                </p>
              </div>
              <AgreedAmountForm
                caseId={caseId}
                initial={defaultFee}
                submitLabel="Enregistrer"
                onDone={done}
              />
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border bg-card p-5">
          {mode === "agreed" ? (
            <AgreedAmountForm
              caseId={caseId}
              initial={agreed}
              submitLabel="Enregistrer"
              onDone={done}
              onCancel={() => setMode("idle")}
            />
          ) : (
            <dl className="grid gap-4 sm:grid-cols-3">
              <Figure label="Montant convenu" value={formatDA(summary.agreed ?? 0)} />
              <Figure label="Payé" value={formatDA(paid)} />
              <Figure
                label="Reste à payer"
                value={formatDA(summary.remaining ?? 0)}
                className={summary.remaining === 0 ? "text-success" : undefined}
              />
            </dl>
          )}
          <div
            role="progressbar"
            aria-label="Part payée"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={summary.percent}
            className="mt-5 h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                summary.state === "paid" ? "bg-success" : "bg-primary",
              )}
              style={{ width: `${summary.percent}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
              <span className="text-xs text-muted-foreground tabular-nums">
                {summary.percent} % payé
              </span>
            </div>
            {isOwner && mode !== "agreed" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMessage(null);
                  setMode("agreed");
                }}
              >
                <Pencil /> Modifier le montant
              </Button>
            )}
          </div>
        </section>
      )}

      {mode === "pay" && summary.remaining !== null && (
        <PaymentForm
          caseId={caseId}
          remaining={summary.remaining}
          onDone={done}
          onCancel={() => setMode("idle")}
        />
      )}

      <p
        role="status"
        aria-live="polite"
        className={cn(
          "min-h-5 px-1 text-sm",
          message?.error ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {message?.text}
      </p>

      {payments.length === 0 ? (
        agreed !== null &&
        mode !== "pay" && (
          <div className="rounded-xl border border-dashed px-6 py-10 text-center">
            <Banknote className="mx-auto size-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm font-medium">Aucun paiement pour le moment</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Enregistrez chaque somme reçue : en une fois ou en plusieurs.
            </p>
          </div>
        )
      ) : (
        <section aria-label="Paiements reçus" className="space-y-2">
          <h3 className="px-1 text-sm font-medium text-muted-foreground">Paiements reçus</h3>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {payments.map((p) => (
              <PaymentLine
                key={p.id}
                payment={p}
                canCancel={isOwner}
                onCancel={() => {
                  setMessage(null);
                  setReason("");
                  setToCancel(p);
                }}
              />
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={toCancel !== null}
        title="Annuler ce paiement ?"
        body={
          toCancel
            ? `Le paiement de ${formatDA(toCancel.amount)} du ${formatLongDate(toCancel.paidOn)} ne comptera plus. Il reste visible, barré, avec le motif.`
            : ""
        }
        confirmLabel="Annuler le paiement"
        cancelLabel="Retour"
        danger
        loading={cancelling}
        confirmDisabled={reason.trim() === ""}
        onConfirm={() => void cancel()}
        onCancel={() => setToCancel(null)}
      >
        <TextAreaField
          id="cancel-reason"
          label="Motif"
          maxLength={300}
          value={reason}
          onChange={setReason}
          placeholder="Ex. : erreur de saisie, montant en double…"
        />
      </ConfirmDialog>
    </div>
  );
}
