"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, FolderPlus, MessageSquareText } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MetaList, StatusMessage, type ActionMessage } from "@/components/page-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import type { CaseFieldsRecord } from "@/features/cases/case-record";
import {
  DIPLOMA_TYPE_LABELS,
  EDUCATION_LEVEL_LABELS,
  LANGUAGE_TEST_LABELS,
  labelOf,
} from "@/features/cases/labels";
import { callApi } from "@/lib/api-client";
import { formatLongDate, formatShortDate } from "@/lib/dates";
import { displayName } from "@/lib/names";
import { telHref } from "@/lib/phone";

// Libellé au-dessus de sa valeur
function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

// Une demande d'inscription en ligne : qui, pour quelle campagne, son
// message ; le détail du parcours se déplie. « Créer le dossier » ouvre le
// formulaire habituel déjà rempli ; « Refuser » supprime la demande.
export function SignupCard({
  id,
  fields: f,
  campaignName,
  message,
  receivedOn,
  readOnly,
}: {
  id: string;
  fields: CaseFieldsRecord;
  // null : campagne supprimée depuis l'envoi
  campaignName: string | null;
  message: string | null;
  receivedOn: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<ActionMessage>(null);
  const name = displayName(f.first_name, f.last_name);

  async function refuse() {
    setLoading(true);
    const res = await callApi(`/api/signups/${id}`, { method: "DELETE" });
    setLoading(false);
    setConfirming(false);
    if (!res.ok) return setStatus({ text: res.error, error: true });
    router.refresh();
  }

  const extra = [
    f.current_field && ["Filière", f.current_field],
    f.current_institution && ["Établissement", f.current_institution],
    f.nationality && ["Nationalité", f.nationality],
    f.secondary_contact_name && [
      "Contact secondaire",
      `${f.secondary_contact_name} (${f.secondary_contact_phone})`,
    ],
  ].filter(Boolean) as [string, string][];
  const hasDetails = extra.length > 0 || f.diplomas.length > 0 || f.language_tests.length > 0;

  return (
    <li id={id} className="scroll-mt-6 rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 className="font-semibold">{name}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            <MetaList
              items={[
                campaignName ?? "Campagne supprimée",
                labelOf(EDUCATION_LEVEL_LABELS, f.education_level),
                `Reçue le ${receivedOn}`,
              ]}
            />
          </p>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/cases/new?inscription=${id}`}
              className={buttonVariants({ size: "sm" })}
            >
              <FolderPlus /> Créer le dossier
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirming(true)}
            >
              Refuser
            </Button>
          </div>
        )}
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Info label="Téléphone">
          <a href={telHref(f.phone)} className="font-medium hover:text-link hover:underline">
            {f.phone}
          </a>
        </Info>
        <Info label="Naissance">{formatLongDate(f.birth_date)}</Info>
        {f.email && (
          <Info label="E-mail">
            <a href={`mailto:${f.email}`} className="break-all hover:text-link hover:underline">
              {f.email}
            </a>
          </Info>
        )}
        {f.city && <Info label="Ville">{f.city}</Info>}
      </dl>

      {message && (
        <blockquote className="mt-4 flex gap-2.5 rounded-xl bg-muted/50 px-3.5 py-3 text-sm">
          <MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 break-words whitespace-pre-line">{message}</p>
        </blockquote>
      )}

      {hasDetails && (
        <details className="group mt-3">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-md py-1 text-sm font-medium text-link [&::-webkit-details-marker]:hidden">
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
            Parcours détaillé
          </summary>
          <div className="mt-2 space-y-3 text-sm">
            {extra.length > 0 && (
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {extra.map(([label, value]) => (
                  <Info key={label} label={label}>
                    {value}
                  </Info>
                ))}
              </dl>
            )}
            {f.diplomas.length > 0 && (
              <div>
                <p className="font-medium">Diplômes</p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {f.diplomas.map((d, i) => (
                    <li key={i}>
                      {[labelOf(DIPLOMA_TYPE_LABELS, d.type), d.title].filter(Boolean).join(" : ")}
                      {d.year !== null && ` (${d.year})`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {f.language_tests.length > 0 && (
              <div>
                <p className="font-medium">Tests de langue</p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {f.language_tests.map((t, i) => (
                    <li key={i}>
                      {t.test === "other" ? t.other_name : labelOf(LANGUAGE_TEST_LABELS, t.test)}
                      {t.result && ` : ${t.result}`}
                      {t.date && ` (${formatShortDate(t.date)})`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      <StatusMessage message={status} className="mt-2 min-h-0" />

      <ConfirmDialog
        open={confirming}
        title={`Refuser la demande de ${name} ?`}
        body="Elle est supprimée. Le candidat n'est pas prévenu : contactez-le si besoin."
        confirmLabel="Refuser la demande"
        danger
        loading={loading}
        onConfirm={() => void refuse()}
        onCancel={() => setConfirming(false)}
      />
    </li>
  );
}
